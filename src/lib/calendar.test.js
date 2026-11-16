import { describe, it, expect } from 'vitest';
import {
  hhmm, addDays, getLessonTypes, findLessonType, makeCustomLessonType, lessonsOnDate, eventsOnDate, lessonStats,
  timesOverlap, planCopyDay, planCopyWeek, validateLesson, buildPrintScheduleHTML, escapeHtml, studentLevelSummary,
} from './calendar.js';

describe('basics', () => {
  it('hhmm / addDays', () => {
    expect(hhmm('9:05:00')).toBe('09:05');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-08', 7)).toBe('2026-03-15'); // across US DST change
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('lesson types merge custom types and fall back', () => {
    const custom = [{ id: 'custom_1', name: 'Jumps', icon: '🦘', color: '#ff0000', max: 3, rate: 40 }, { id: 'bad' }];
    const types = getLessonTypes(JSON.stringify(custom));
    expect(types.map((t) => t.id)).toEqual(['private', 'shared', 'group', 'custom_1']);
    expect(findLessonType(types, 'custom_1').rate).toBe(40);
    expect(findLessonType(types, 'nope').id).toBe('private');
  });
  it('makeCustomLessonType validates', () => {
    expect(makeCustomLessonType({ name: ' ' }).error).toBe('Please enter a name');
    expect(makeCustomLessonType({ name: 'X', max: 0, rate: 1 }).error).toMatch(/Max/);
    expect(makeCustomLessonType({ name: 'X', max: 2, rate: 30, icon: '📚', color: '#3b82f6' }, 5).type)
      .toEqual({ id: 'custom_5', name: 'X', icon: '📚', color: '#3b82f6', max: 2, rate: 30 });
  });
});

describe('filters', () => {
  const lessons = [
    { id: 1, date: '2026-03-10', start_time: '11:00', is_published: true, rate: 50 },
    { id: 2, date: '2026-03-10', start_time: '09:00', is_published: false, rate: 75 },
    { id: 3, date: '2026-03-12', start_time: '09:00', is_published: true, rate: 30 },
    { id: 4, date: '2026-04-01', start_time: '09:00', is_published: true, rate: 30 },
  ];
  it('clients only see published, sorted', () => {
    expect(lessonsOnDate(lessons, '2026-03-10', true).map((l) => l.id)).toEqual([2, 1]);
    expect(lessonsOnDate(lessons, '2026-03-10', false).map((l) => l.id)).toEqual([1]);
  });
  it('events span start..end inclusive', () => {
    const ev = [{ id: 1, start_date: '2026-03-09', end_date: '2026-03-11' }, { id: 2, start_date: '2026-03-12', end_date: null }];
    expect(eventsOnDate(ev, '2026-03-11').map((e) => e.id)).toEqual([1]);
    expect(eventsOnDate(ev, '2026-03-12').map((e) => e.id)).toEqual([2]);
  });
  it('stats', () => {
    const s = lessonStats(lessons, new Date(2026, 2, 10, 23, 30));
    expect(s).toEqual({ monthCount: 3, monthRevenue: 155, todayCount: 2, weekCount: 1 });
  });
});

describe('copy planning', () => {
  const lessons = [
    { id: 1, date: '2026-03-09', start_time: '09:00', end_time: '09:30', lesson_type: 'private', max_students: 1, rate: 75, venue_id: 2, notes: '', is_published: true, created_at: 'x', coach_id: 'c' },
    { id: 2, date: '2026-03-09', start_time: '10:00', end_time: '11:00', lesson_type: 'group', max_students: 8, rate: 35, venue_id: null, notes: 'n', is_published: true },
    { id: 3, date: '2026-03-10', start_time: '10:30', end_time: '11:30', lesson_type: 'private', max_students: 1, rate: 75, is_published: true },
  ];
  it('overlap detection', () => {
    expect(timesOverlap({ start_time: '10:00', end_time: '11:00' }, { start_time: '10:30', end_time: '11:30' })).toBe(true);
    expect(timesOverlap({ start_time: '09:00', end_time: '09:30' }, { start_time: '09:30', end_time: '10:00' })).toBe(false);
  });
  it('copy day skips conflicts and makes unpublished drafts without ids', () => {
    const r = planCopyDay(lessons, '2026-03-09', ['2026-03-10', '2026-03-11', '2026-03-09']);
    expect(r.sourceCount).toBe(2);
    expect(r.skipped).toBe(1);
    expect(r.inserts).toHaveLength(3);
    expect(r.inserts.every((x) => x.is_published === false && !('id' in x) && !('created_at' in x) && !('coach_id' in x))).toBe(true);
    expect(r.inserts.find((x) => x.date === '2026-03-10').start_time).toBe('09:00');
  });
  it('copy week N weeks forward', () => {
    const r = planCopyWeek([...lessons, { id: 9, date: '2026-03-16', start_time: '09:15', end_time: '09:45' }], '2026-03-11', 2);
    expect(r.start).toBe('2026-03-08');
    expect(r.end).toBe('2026-03-14');
    expect(r.sourceCount).toBe(3);
    expect(r.skipped).toBe(1);
    expect(r.inserts.map((x) => x.date).sort()).toEqual(['2026-03-16', '2026-03-17', '2026-03-23', '2026-03-23', '2026-03-24']);
  });
});

describe('validateLesson', () => {
  const ok = { date: '2026-03-10', start_time: '09:00', end_time: '09:30', lesson_type: 'private', max_students: 1, rate: 75, student_ids: [] };
  it('valid', () => expect(validateLesson(ok)).toBeNull());
  it('errors', () => {
    expect(validateLesson({ ...ok, date: '' })).toMatch(/date/);
    expect(validateLesson({ ...ok, end_time: '09:00' })).toMatch(/End time/);
    expect(validateLesson({ ...ok, max_students: NaN })).toMatch(/Max/);
    expect(validateLesson({ ...ok, rate: -1 })).toMatch(/Rate/);
    expect(validateLesson({ ...ok, student_ids: [1, 2] })).toMatch(/less than/);
    expect(validateLesson({ ...ok, max_students: 2, student_ids: [1] }, { activeBookings: 2 })).toMatch(/less than/);
  });
});

describe('print', () => {
  it('escapes interpolated text', () => {
    expect(escapeHtml('<b>"x"&\'')).toBe('&lt;b&gt;&quot;x&quot;&amp;&#39;');
    const html = buildPrintScheduleHTML({
      date: '2026-03-10',
      lessons: [{ id: 1, date: '2026-03-10', start_time: '09:00', end_time: '09:30', lesson_type: 'private', venue_id: 1 }],
      bookings: [{ lesson_id: 1, student_id: 5, status: 'confirmed' }],
      students: [{ id: 5, name: '<script>alert(1)</script>', client_id: 8, isi_freestyle: 'FS3' }],
      clients: [{ id: 8, name: 'Mom & Dad', phone: '555' }],
      venues: [{ id: 1, name: '<img src=x onerror=alert(1)>' }],
      lessonTypes: getLessonTypes([]),
    });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Mom &amp; Dad');
    expect(html).toContain('ISI Freestyle: FS3');
  });
  it('level summary skips numbers/empties', () => {
    expect(studentLevelSummary({ isi_number: '123', isi_freestyle: '', usfsa_singles: 'Juvenile' })).toBe('USFSA Singles: Juvenile');
  });
});
