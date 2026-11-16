// Pure calendar helpers: lesson types, per-day filtering, copy day/week planning, validation, print HTML.
import { DEFAULT_LESSON_TYPES, EVENT_TYPES } from './constants.js';
import { parseLocalDate, toISODate, weekDays, formatTime } from './format.js';

/** "13:30:00" | "13:30" | "9:05" -> "13:30" / "09:05" ('' for empty). */
export const hhmm = (t) => {
  if (!t) return '';
  const [h = '0', m = '0'] = String(t).split(':');
  return `${String(parseInt(h, 10) || 0).padStart(2, '0')}:${String(parseInt(m, 10) || 0).padStart(2, '0')}`;
};

/** Add n days to a YYYY-MM-DD string (local, DST safe). */
export const addDays = (iso, n) => {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

/** Normalise one custom lesson type; returns null when unusable. */
const normalizeType = (t) => {
  if (!t || typeof t !== 'object' || !t.id || !String(t.name || '').trim()) return null;
  const max = parseInt(t.max, 10);
  const rate = Number(t.rate);
  return {
    id: String(t.id),
    name: String(t.name).trim(),
    icon: t.icon || '📚',
    color: /^#[0-9a-f]{3,8}$/i.test(t.color || '') ? t.color : '#3b82f6',
    max: Number.isFinite(max) && max >= 1 ? max : 1,
    rate: Number.isFinite(rate) && rate >= 0 ? rate : 0,
  };
};

/** DEFAULT_LESSON_TYPES followed by the coach's custom types (settings.custom_lesson_types). */
export const getLessonTypes = (custom) => {
  let list = custom;
  if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
  const extra = (Array.isArray(list) ? list : []).map(normalizeType).filter(Boolean)
    .filter((t) => !DEFAULT_LESSON_TYPES.some((d) => d.id === t.id));
  return [...DEFAULT_LESSON_TYPES, ...extra];
};

/** Find a lesson type by id (falls back to the first type, as the old app did). */
export const findLessonType = (types, id) => types.find((t) => t.id === id) || types[0] || DEFAULT_LESSON_TYPES[0];
export const findEventType = (id) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[0];

/** Build a new custom lesson type from the add-type form; returns { type } or { error }. */
export const makeCustomLessonType = (form, now = Date.now()) => {
  if (!String(form?.name || '').trim()) return { error: 'Please enter a name' };
  const max = parseInt(form.max, 10);
  if (!Number.isFinite(max) || max < 1) return { error: 'Max students must be at least 1' };
  const rate = Number(form.rate);
  if (!Number.isFinite(rate) || rate < 0) return { error: 'Rate must be 0 or more' };
  return { type: normalizeType({ ...form, id: `custom_${now}`, max, rate }) };
};

export const sortByStart = (a, b) => hhmm(a.start_time).localeCompare(hhmm(b.start_time));

/** Lessons on a date; clients only see published lessons. Sorted by start time. */
export const lessonsOnDate = (lessons, iso, isCoach = true) =>
  (lessons || []).filter((l) => l.date === iso && (isCoach || l.is_published)).sort(sortByStart);

/** Events covering a date (start_date..end_date inclusive). */
export const eventsOnDate = (events, iso) =>
  (events || []).filter((e) => e.start_date && iso >= e.start_date && iso <= (e.end_date || e.start_date));

/** Coach dashboard numbers (string date comparisons: no UTC shifting). */
export const lessonStats = (lessons, today = new Date()) => {
  const t = toISODate(today);
  const monthPrefix = t.slice(0, 7);
  const month = (lessons || []).filter((l) => String(l.date).slice(0, 7) === monthPrefix);
  const weekEnd = addDays(t, 7);
  return {
    monthCount: month.length,
    monthRevenue: month.reduce((s, l) => s + (Number(l.rate) || 0), 0),
    todayCount: (lessons || []).filter((l) => l.date === t).length,
    weekCount: (lessons || []).filter((l) => l.date > t && l.date <= weekEnd).length,
  };
};

/** True when two lessons on the same date overlap in time. */
export const timesOverlap = (a, b) => {
  const as = hhmm(a.start_time), ae = hhmm(a.end_time) || as;
  const bs = hhmm(b.start_time), be = hhmm(b.end_time) || bs;
  if (as === bs && ae === be) return true;
  return as < be && bs < ae;
};

/** Row to insert when copying a lesson to another date (copies are unpublished drafts, as old). */
export const toLessonCopy = (l, date) => ({
  date,
  start_time: l.start_time,
  end_time: l.end_time,
  lesson_type: l.lesson_type,
  venue_id: l.venue_id ?? null,
  max_students: l.max_students,
  notes: l.notes ?? '',
  rate: l.rate,
  is_published: false,
});

const planCopies = (lessons, pairs) => {
  const planned = [];
  let skipped = 0;
  for (const { src, date } of pairs) {
    const occupied = [...(lessons || []).filter((l) => l.date === date), ...planned.filter((p) => p.date === date)];
    if (occupied.some((o) => timesOverlap(o, src))) { skipped++; continue; }
    planned.push(toLessonCopy(src, date));
  }
  return { inserts: planned, skipped };
};

/** Copy all lessons of sourceISO to each target date, skipping time conflicts. */
export const planCopyDay = (lessons, sourceISO, targetISOs) => {
  const sources = (lessons || []).filter((l) => l.date === sourceISO).sort(sortByStart);
  const pairs = [];
  for (const date of targetISOs || []) {
    if (date === sourceISO) continue;
    for (const src of sources) pairs.push({ src, date });
  }
  return { sourceCount: sources.length, ...planCopies(lessons, pairs) };
};

/** Copy the Sun..Sat week containing anchor to the next `weeks` weeks, skipping time conflicts. */
export const planCopyWeek = (lessons, anchor, weeks) => {
  const days = weekDays(parseLocalDate(anchor));
  const start = toISODate(days[0]);
  const end = toISODate(days[6]);
  const sources = (lessons || []).filter((l) => l.date >= start && l.date <= end).sort((a, b) =>
    a.date === b.date ? sortByStart(a, b) : a.date.localeCompare(b.date));
  const pairs = [];
  for (let w = 1; w <= weeks; w++) for (const src of sources) pairs.push({ src, date: addDays(src.date, 7 * w) });
  return { sourceCount: sources.length, start, end, ...planCopies(lessons, pairs) };
};

/** Validate the lesson form. Returns an error message or null. */
export const validateLesson = (f, { activeBookings = 0 } = {}) => {
  if (!f.date || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return 'Please choose a date';
  if (!f.start_time || !f.end_time) return 'Please enter start and end times';
  if (hhmm(f.end_time) <= hhmm(f.start_time)) return 'End time must be after start time';
  if (!f.lesson_type) return 'Please choose a lesson type';
  const max = Number(f.max_students);
  if (!Number.isInteger(max) || max < 1) return 'Max students must be at least 1';
  const wanted = activeBookings + (f.student_ids?.length || 0);
  if (wanted > max) return `Max students (${max}) is less than the ${wanted} student(s) booked`;
  const rate = Number(f.rate);
  if (f.rate === '' || f.rate == null || !Number.isFinite(rate) || rate < 0) return 'Rate must be 0 or more';
  return null;
};

const LEVEL_PREFIXES = [['isi_', 'ISI'], ['usfsa_', 'USFSA'], ['lts_', 'LTS']];
/** Short level summary from the per-discipline level columns ("ISI Freestyle: FS3 | USFSA Singles: Juv"). */
export const studentLevelSummary = (s, limit = 2) => {
  if (!s) return '';
  const out = [];
  for (const [key, val] of Object.entries(s)) {
    if (!val || typeof val !== 'string' || key.endsWith('_number')) continue;
    const p = LEVEL_PREFIXES.find(([pre]) => key.startsWith(pre));
    if (!p) continue;
    const label = key.slice(p[0].length).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    out.push(`${p[1]} ${label}: ${val}`);
  }
  return out.slice(0, limit).join(' | ');
};

export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Printable day schedule (all interpolated text escaped). */
export const buildPrintScheduleHTML = ({ date, lessons, bookings, students, clients, venues, lessonTypes }) => {
  const e = escapeHtml;
  const title = parseLocalDate(date).toLocaleDateString();
  const day = lessonsOnDate(lessons, date, true);
  let rows = '';
  if (day.length === 0) {
    rows = '<tr><td colspan="6" class="no-lessons">No lessons scheduled</td></tr>';
  } else {
    for (const l of day) {
      const t = findLessonType(lessonTypes, l.lesson_type);
      const v = (venues || []).find((x) => x.id === l.venue_id);
      const bk = (bookings || []).filter((b) => b.lesson_id === l.id && b.status !== 'cancelled');
      const time = `${e(formatTime(l.start_time))} - ${e(formatTime(l.end_time))}`;
      const kind = `${e(t.icon)} ${e(t.name)}`;
      const venue = e(v?.name || '');
      if (bk.length === 0) {
        rows += `<tr><td>${time}</td><td>${kind}</td><td>${venue}</td><td colspan="3" style="color: #9ca3af;">No bookings</td></tr>`;
        continue;
      }
      bk.forEach((b, i) => {
        const s = (students || []).find((x) => x.id === b.student_id);
        const c = (clients || []).find((x) => x.id === s?.client_id);
        rows += i === 0
          ? `<tr><td rowspan="${bk.length}">${time}</td><td rowspan="${bk.length}">${kind}</td><td rowspan="${bk.length}">${venue}</td>`
          : '<tr>';
        rows += `<td>${e(s?.name || 'Unknown')}</td><td>${e(c?.name || '')}<br/>${e(c?.phone || '')}</td><td>${e(studentLevelSummary(s))}</td></tr>`;
      });
    }
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Schedule - ${e(title)}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; }
  h1 { font-size: 20px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
  .no-lessons { color: #6b7280; padding: 20px; }
</style></head><body>
<h1>IceBooks Pro - Schedule for ${e(title)}</h1>
<table><thead><tr><th>Time</th><th>Lesson</th><th>Venue</th><th>Students</th><th>Parent Contact</th><th>Level</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
};
