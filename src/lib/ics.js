// RFC 5545 iCalendar export/import helpers.
import { findLessonType, findEventType, addDays, hhmm } from './calendar.js';
import { toISODate, pad2, formatTime } from './format.js';

const CRLF = '\r\n';

/** Escape a TEXT value: backslash, semicolon, comma, newline. */
export const escapeText = (v) =>
  String(v ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

/** Reverse of escapeText. */
export const unescapeText = (v) =>
  String(v ?? '').replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));

const utf8Len = (cp) => (cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4);

/** Fold a content line to at most 75 octets per physical line (continuations start with a space). */
export const foldLine = (line) => {
  const out = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = utf8Len(ch.codePointAt(0));
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join(CRLF);
};

/** Unfold folded lines (CRLF or LF followed by space/tab). */
export const unfold = (text) => String(text || '').replace(/\r?\n[ \t]/g, '');

const stamp = (d) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
const icsDate = (iso) => String(iso).slice(0, 10).replace(/-/g, '');
const icsTime = (t) => `${hhmm(t).replace(':', '')}00`;

/** Build the .ics text for lessons + events. */
export const buildICS = ({ lessons = [], events = [], bookings = [], students = [], venues = [], lessonTypes = [], now = new Date() }) => {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IceBooks Pro//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:IceBooks Schedule'];
  const dtstamp = stamp(now);
  for (const l of lessons) {
    if (!l.date || !l.start_time) continue;
    const t = findLessonType(lessonTypes, l.lesson_type);
    const v = venues.find((x) => x.id === l.venue_id);
    const names = bookings.filter((b) => b.lesson_id === l.id && b.status !== 'cancelled')
      .map((b) => students.find((s) => s.id === b.student_id)?.name).filter(Boolean).join(', ');
    const d = icsDate(l.date);
    lines.push(
      'BEGIN:VEVENT',
      `UID:icebooks-lesson-${l.id}@icebooks`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${d}T${icsTime(l.start_time)}`,
      `DTEND:${d}T${icsTime(l.end_time || l.start_time)}`,
      `SUMMARY:${escapeText(`${t.icon} ${t.name}${names ? ` - ${names}` : ''}`)}`,
      `LOCATION:${escapeText(v?.name || '')}`,
      ...(l.notes ? [`DESCRIPTION:${escapeText(l.notes)}`] : []),
      `STATUS:${l.is_published ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    );
  }
  for (const e of events) {
    if (!e.start_date) continue;
    const t = findEventType(e.event_type);
    const v = venues.find((x) => x.id === e.venue_id);
    const end = e.end_date && e.end_date >= e.start_date ? e.end_date : e.start_date;
    lines.push(
      'BEGIN:VEVENT',
      `UID:icebooks-event-${e.id}@icebooks`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(e.start_date)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`, // DTEND is exclusive for all-day events
      `SUMMARY:${escapeText(`${t.icon} ${e.name || ''}`)}`,
      ...(v ? [`LOCATION:${escapeText(v.name)}`] : []),
      `DESCRIPTION:${escapeText(e.notes || '')}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join(CRLF) + CRLF;
};

/** Split "NAME;P=1;P2=\"a:b\":value" into { name, params, value }. */
const splitLine = (line) => {
  let inQuote = false;
  let idx = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ':' && !inQuote) { idx = i; break; }
  }
  if (idx < 0) return null;
  const head = line.slice(0, idx).split(';');
  const params = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(idx + 1) };
};

/** Parse a DATE or DATE-TIME value -> { date: 'YYYY-MM-DD', time: 'HH:MM' | null }. UTC (Z) values convert to local. */
export const parseICSDate = (value, params = {}) => {
  const v = String(value || '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (params.VALUE === 'DATE' || h == null) return { date: `${y}-${mo}-${d}`, time: null };
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)));
    return { date: toISODate(dt), time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}` };
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
};

/** Parse VEVENTs -> [{ name, date, end_date, start_time, end_time, allDay, location, description }]. */
export const parseICS = (text) => {
  const out = [];
  let cur = null;
  let depth = 0; // nesting inside the VEVENT (VALARM etc.)
  for (const raw of unfold(text).split(/\r?\n/)) {
    const line = raw.replace(/\r$/, '');
    if (!line) continue;
    const p = splitLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && !cur) { cur = {}; depth = 0; } else if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && depth > 0) depth--;
      else if (cur && p.value.toUpperCase() === 'VEVENT') {
        if (cur.date) out.push({
          name: cur.name || '', date: cur.date, end_date: cur.end_date || cur.date, start_time: cur.start_time || null,
          end_time: cur.end_time || null, allDay: !cur.start_time, location: cur.location || '', description: cur.description || '',
        });
        cur = null;
      }
      continue;
    }
    if (!cur || depth > 0) continue;
    if (p.name === 'SUMMARY') cur.name = unescapeText(p.value).replace(/\s*\n\s*/g, ' ').trim();
    else if (p.name === 'LOCATION') cur.location = unescapeText(p.value).trim();
    else if (p.name === 'DESCRIPTION') cur.description = unescapeText(p.value);
    else if (p.name === 'DTSTART') {
      const d = parseICSDate(p.value, p.params);
      if (d) { cur.date = d.date; cur.start_time = d.time; }
    } else if (p.name === 'DTEND') {
      const d = parseICSDate(p.value, p.params);
      if (d) { cur.end_raw = d; cur.end_time = d.time; }
    }
    if (cur.date && cur.end_raw) {
      // All-day DTEND is exclusive; timed DTEND is the actual end.
      let end = cur.end_raw.time ? cur.end_raw.date : addDays(cur.end_raw.date, -1);
      if (end < cur.date) end = cur.date;
      cur.end_date = end;
    }
  }
  return out;
};

const dupKey = (name, date) => `${String(name || '').trim().toLowerCase()}|${date}`;

/**
 * Turn parsed VEVENTs into `events` insert rows (type 'personal', as old).
 * Skips duplicates by name+start_date (against existing events and within the file).
 */
export const planICSImport = (parsed, existingEvents = []) => {
  const seen = new Set((existingEvents || []).map((e) => dupKey(e.name, e.start_date)));
  const rows = [];
  let duplicates = 0;
  let invalid = 0;
  for (const ev of parsed || []) {
    const name = String(ev.name || '').slice(0, 100).trim();
    if (!name || !ev.date) { invalid++; continue; }
    const key = dupKey(name, ev.date);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    const time = ev.start_time ? ` (${formatTime(ev.start_time)}${ev.end_time ? ` - ${formatTime(ev.end_time)}` : ''})` : '';
    rows.push({
      name,
      event_type: 'personal',
      start_date: ev.date,
      end_date: ev.end_date || ev.date,
      notes: `Imported from ICS${time}${ev.location ? ` - Location: ${ev.location}` : ''}`,
    });
  }
  return { rows, duplicates, invalid };
};
