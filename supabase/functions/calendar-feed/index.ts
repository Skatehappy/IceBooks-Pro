// calendar-feed: GET ?token=<settings.calendar_token>  ->  text/calendar (.ics) of that coach's lessons + events.
// verify_jwt = false (calendar apps cannot send a JWT). The unguessable token is the credential; the lookup uses
// the service role (SUPABASE_SERVICE_ROLE_KEY, injected by the runtime) and returns 404 for an unknown token.
// To revoke a leaked URL the coach regenerates settings.calendar_token (update ... set calendar_token = gen_random_uuid()).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders } from '../_shared/cors.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HISTORY_DAYS = 180;

const DEFAULT_LESSON_TYPES = [
  { id: 'private', name: 'Private', icon: '👤' },
  { id: 'shared', name: 'Shared', icon: '👥' },
  { id: 'group', name: 'Group', icon: '👨‍👩‍👧‍👦' },
];
const EVENT_TYPES: Record<string, { name: string; icon: string }> = {
  competition: { name: 'Competition', icon: '🏆' },
  show: { name: 'Ice Show', icon: '⭐' },
  testing: { name: 'Testing', icon: '📋' },
  personal: { name: 'Personal', icon: '📅' },
  blocked: { name: 'Blocked', icon: '🚫' },
};

const icsText = (s: unknown) =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

// RFC 5545 line folding at 75 octets.
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ''; }
    cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (d: string) => d.slice(0, 10).replace(/-/g, '');
const hms = (t: string) => (t.length === 5 ? `${t}:00` : t.slice(0, 8)).replace(/:/g, '');
function nextDay(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + 1));
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const token = new URL(req.url).searchParams.get('token') ?? '';
  const notFound = () => new Response('Not found', { status: 404, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  if (!UUID_RE.test(token)) return notFound();

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: settings } = await admin.from('settings')
    .select('coach_id, coach_name, custom_lesson_types').eq('calendar_token', token).maybeSingle();
  if (!settings) return notFound();
  const coachId = settings.coach_id as string;

  const since = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString().slice(0, 10);
  const [lessonsRes, eventsRes, venuesRes] = await Promise.all([
    admin.from('lessons').select('id,date,start_time,end_time,lesson_type,venue_id,is_published,notes')
      .eq('coach_id', coachId).gte('date', since).order('date').limit(5000),
    admin.from('events').select('id,name,event_type,start_date,end_date,venue_id,notes')
      .eq('coach_id', coachId).or(`end_date.gte.${since},start_date.gte.${since}`).order('start_date').limit(2000),
    admin.from('venues').select('id,name,address').eq('coach_id', coachId),
  ]);
  if (lessonsRes.error || eventsRes.error || venuesRes.error) {
    return new Response('Calendar temporarily unavailable', { status: 500, headers: corsHeaders });
  }
  const lessons = lessonsRes.data ?? [];
  const events = eventsRes.data ?? [];
  const venues = new Map((venuesRes.data ?? []).map((v) => [v.id, v]));

  // Student names per lesson (non-cancelled bookings), fetched in chunks.
  const names = new Map<number, string[]>();
  const ids = lessons.map((l) => l.id);
  for (let i = 0; i < ids.length; i += 500) {
    const { data: bk } = await admin.from('bookings').select('lesson_id, students(name)')
      .in('lesson_id', ids.slice(i, i + 500)).neq('status', 'cancelled');
    // deno-lint-ignore no-explicit-any
    for (const b of (bk ?? []) as any[]) {
      const n = b.students?.name;
      if (!n) continue;
      names.set(b.lesson_id, [...(names.get(b.lesson_id) ?? []), n]);
    }
  }

  let custom: { id: string; name: string; icon?: string }[] = [];
  try {
    const raw = settings.custom_lesson_types;
    custom = Array.isArray(raw) ? raw : JSON.parse(raw || '[]');
  } catch { custom = []; }
  const lessonType = (id: string) =>
    custom.find((t) => t.id === id) ?? DEFAULT_LESSON_TYPES.find((t) => t.id === id) ?? DEFAULT_LESSON_TYPES[0];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IceBooks Pro//Calendar Feed//EN', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${icsText(`IceBooks - ${settings.coach_name || 'Coach'}`)}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];

  for (const l of lessons) {
    const t = lessonType(l.lesson_type);
    const who = (names.get(l.id) ?? []).join(', ');
    const v = l.venue_id ? venues.get(l.venue_id) : null;
    lines.push(
      'BEGIN:VEVENT',
      `UID:icebooks-lesson-${l.id}@icebooks`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd(l.date)}T${hms(l.start_time)}`,
      `DTEND:${ymd(l.date)}T${hms(l.end_time)}`,
      `SUMMARY:${icsText(`${t.icon ?? ''} ${t.name}${who ? ` - ${who}` : ''}`.trim())}`,
      `LOCATION:${icsText(v?.name ?? '')}`,
      ...(l.notes ? [`DESCRIPTION:${icsText(l.notes)}`] : []),
      `STATUS:${l.is_published ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }
  for (const e of events) {
    const t = EVENT_TYPES[e.event_type] ?? EVENT_TYPES.personal;
    const v = e.venue_id ? venues.get(e.venue_id) : null;
    lines.push(
      'BEGIN:VEVENT',
      `UID:icebooks-event-${e.id}@icebooks`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start_date)}`,
      `DTEND;VALUE=DATE:${nextDay(e.end_date || e.start_date)}`,
      `SUMMARY:${icsText(`${t.icon} ${e.name}`)}`,
      `LOCATION:${icsText(v?.name ?? '')}`,
      ...(e.notes ? [`DESCRIPTION:${icsText(e.notes)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');

  const body = lines.map(fold).join('\r\n') + '\r\n';
  return new Response(req.method === 'HEAD' ? null : body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="icebooks.ics"',
      'Cache-Control': 'private, max-age=300',
    },
  });
});
