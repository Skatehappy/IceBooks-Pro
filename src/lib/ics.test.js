import { describe, it, expect } from 'vitest';
import { escapeText, unescapeText, foldLine, unfold, buildICS, parseICS, parseICSDate, planICSImport } from './ics.js';
import { getLessonTypes } from './calendar.js';

const types = getLessonTypes([]);
const byteLen = (s) => new TextEncoder().encode(s).length;

describe('text escaping', () => {
  it('escapes and round-trips , ; \\ and newlines', () => {
    const s = 'A, B; C\\D\nE';
    expect(escapeText(s)).toBe('A\\, B\\; C\\\\D\\nE');
    expect(unescapeText(escapeText(s))).toBe(s);
  });
});

describe('folding', () => {
  it('folds long lines at <=75 octets with CRLF + space, and unfolds', () => {
    const line = 'SUMMARY:' + 'é⛸'.repeat(60);
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(byteLen(part)).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(unfold(folded)).toBe(line);
  });
  it('short lines untouched', () => expect(foldLine('VERSION:2.0')).toBe('VERSION:2.0'));
});

describe('buildICS', () => {
  const ics = buildICS({
    lessons: [{ id: 7, date: '2026-01-05', start_time: '09:00:00', end_time: '09:30:00', lesson_type: 'private', venue_id: 1, is_published: true, notes: 'Bring skates, gloves; water' }],
    events: [{ id: 3, name: 'Regionals, Day 1', event_type: 'competition', start_date: '2026-02-01', end_date: '2026-02-02', notes: 'Line1\nLine2' }],
    bookings: [{ lesson_id: 7, student_id: 2, status: 'confirmed' }, { lesson_id: 7, student_id: 3, status: 'cancelled' }],
    students: [{ id: 2, name: 'Ann' }, { id: 3, name: 'Bob' }],
    venues: [{ id: 1, name: 'Rink A' }],
    lessonTypes: types,
    now: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)),
  });
  it('uses CRLF everywhere and VCALENDAR wrapper', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });
  it('formats times from HH:MM:SS correctly', () => {
    expect(ics).toContain('DTSTART:20260105T090000\r\n');
    expect(ics).toContain('DTEND:20260105T093000\r\n');
    expect(ics).toContain('DTSTAMP:20260101T120000Z');
  });
  it('all-day DTEND is exclusive and text is escaped', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260201');
    expect(ics).toContain('DTEND;VALUE=DATE:20260203');
    expect(ics).toContain('Regionals\\, Day 1');
    expect(ics).toContain('DESCRIPTION:Line1\\nLine2');
    expect(ics).toContain('Bring skates\\, gloves\\; water');
    expect(ics).toContain('Private - Ann');
    expect(ics).not.toContain('Bob');
  });
  it('round-trips through parseICS', () => {
    const parsed = parseICS(ics);
    expect(parsed).toHaveLength(2);
    const [lesson, event] = parsed;
    expect(lesson).toMatchObject({ date: '2026-01-05', start_time: '09:00', end_time: '09:30', location: 'Rink A', description: 'Bring skates, gloves; water' });
    expect(lesson.name).toContain('Private - Ann');
    expect(event).toMatchObject({ date: '2026-02-01', end_date: '2026-02-02', allDay: true, description: 'Line1\nLine2' });
    expect(event.name).toContain('Regionals, Day 1');
  });
});

describe('parseICS', () => {
  it('handles LF files, params, VALUE=DATE, folded lines and nested VALARM', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART;TZID="America/New_York":20260310T143000',
      'DTEND;TZID="America/New_York":20260310T153000',
      'SUMMARY:Practice\\, long',
      '  session',
      'BEGIN:VALARM',
      'DESCRIPTION:Reminder',
      'END:VALARM',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260401',
      'SUMMARY:Holiday',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:No date',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const p = parseICS(text);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ name: 'Practice, long session', date: '2026-03-10', start_time: '14:30', end_time: '15:30', description: '' });
    expect(p[1]).toMatchObject({ name: 'Holiday', date: '2026-04-01', end_date: '2026-04-01', start_time: null, allDay: true });
  });
  it('converts UTC times to local', () => {
    const d = parseICSDate('20260310T143000Z');
    const local = new Date(Date.UTC(2026, 2, 10, 14, 30));
    expect(d.time).toBe(`${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`);
  });
  it('date-only without VALUE param', () => expect(parseICSDate('20261231')).toEqual({ date: '2026-12-31', time: null }));
});

describe('planICSImport', () => {
  it('inserts personal events and skips duplicates by name + start_date', () => {
    const parsed = [
      { name: 'Camp', date: '2026-05-01', end_date: '2026-05-03', location: 'Rink' },
      { name: 'camp ', date: '2026-05-01' },
      { name: 'Existing', date: '2026-06-01' },
      { name: '', date: '2026-06-02' },
      { name: 'Lesson', date: '2026-06-03', start_time: '09:00', end_time: '10:00' },
    ];
    const r = planICSImport(parsed, [{ name: 'Existing', start_date: '2026-06-01' }]);
    expect(r.duplicates).toBe(2);
    expect(r.invalid).toBe(1);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({ name: 'Camp', event_type: 'personal', start_date: '2026-05-01', end_date: '2026-05-03', notes: 'Imported from ICS - Location: Rink' });
    expect(r.rows[1].notes).toBe('Imported from ICS (9:00 AM - 10:00 AM)');
  });
});
