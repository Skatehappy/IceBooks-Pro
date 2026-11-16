import { describe, it, expect } from 'vitest';
import {
  activeBookings, spotsLeft, isFull, toSpotsMap, bookedCount, isLateCancellation, hasStarted, canBook, canCancel,
  friendlyBookingError, normalizeLateHours, spotsText, bookingStatusInfo,
} from './booking.js';

const lesson = { id: 1, date: '2026-03-10', start_time: '10:00:00', end_time: '10:30:00', max_students: 2, is_published: true };
const at = (iso) => new Date(iso); // local time strings (no Z)

describe('capacity', () => {
  const bookings = [
    { id: 1, lesson_id: 1, student_id: 11, status: 'confirmed' },
    { id: 2, lesson_id: 1, student_id: 12, status: 'cancelled' },
    { id: 3, lesson_id: 2, student_id: 13, status: 'confirmed' },
  ];
  it('ignores cancelled bookings and other lessons', () => {
    expect(activeBookings(bookings, 1)).toHaveLength(1);
    expect(spotsLeft(lesson, bookings)).toBe(1);
    expect(isFull(lesson, bookings)).toBe(false);
  });
  it('full lesson', () => {
    const b = [...bookings, { id: 4, lesson_id: 1, student_id: 14, status: 'completed' }];
    expect(spotsLeft(lesson, b)).toBe(0);
    expect(isFull(lesson, b)).toBe(true);
    expect(canBook({ lesson, bookings: b, studentId: 15, now: at('2026-03-01T00:00') })).toEqual({ ok: false, reason: 'Lesson is full' });
  });
  it('never negative', () => {
    const b = [1, 2, 3].map((i) => ({ id: i, lesson_id: 1, student_id: i, status: 'confirmed' }));
    expect(spotsLeft(lesson, b)).toBe(0);
  });
});

describe('lesson_spots merge', () => {
  const mine = [{ id: 1, lesson_id: 1, student_id: 11, status: 'confirmed' }];
  it('toSpotsMap ignores bad rows', () => {
    const m = toSpotsMap([{ lesson_id: 1, booked: 2, max_students: 2 }, { lesson_id: 'x', booked: 1 }, null]);
    expect([...m.entries()]).toEqual([[1, 2]]);
    expect(toSpotsMap(null).size).toBe(0);
  });
  it('uses server counts (other families) when present', () => {
    const spots = toSpotsMap([{ lesson_id: 1, booked: 2, max_students: 2 }]);
    expect(bookedCount(lesson, mine, spots)).toBe(2);
    expect(spotsLeft(lesson, mine, spots)).toBe(0);
    expect(isFull(lesson, mine, spots)).toBe(true);
    expect(canBook({ lesson, bookings: mine, studentId: 12, spots, now: at('2026-03-01T00:00') }).reason).toBe('Lesson is full');
  });
  it('falls back to visible bookings when no map / lesson missing, never below local count', () => {
    expect(spotsLeft(lesson, mine, null)).toBe(1);
    expect(spotsLeft(lesson, mine, new Map())).toBe(1);
    expect(bookedCount(lesson, mine, new Map([[1, 0]]))).toBe(1);
  });
});

describe('canBook', () => {
  const now = at('2026-03-01T09:00');
  it('ok when open', () => expect(canBook({ lesson, bookings: [], studentId: 5, now }).ok).toBe(true));
  it('already booked', () => {
    const b = [{ id: 1, lesson_id: 1, student_id: 5, status: 'confirmed' }];
    expect(canBook({ lesson, bookings: b, studentId: 5, now }).reason).toBe('Student already booked');
  });
  it('a cancelled booking does not block rebooking', () => {
    const b = [{ id: 1, lesson_id: 1, student_id: 5, status: 'cancelled' }];
    expect(canBook({ lesson, bookings: b, studentId: 5, now }).ok).toBe(true);
  });
  it('client cannot book unpublished or past lessons; coach can', () => {
    expect(canBook({ lesson: { ...lesson, is_published: false }, bookings: [], studentId: 5, now }).ok).toBe(false);
    expect(canBook({ lesson: { ...lesson, is_published: false }, bookings: [], studentId: 5, now, isCoach: true }).ok).toBe(true);
    const later = at('2026-03-10T10:00');
    expect(canBook({ lesson, bookings: [], studentId: 5, now: later }).reason).toBe('This lesson has already started');
    expect(canBook({ lesson, bookings: [], studentId: 5, now: later, isCoach: true }).ok).toBe(true);
  });
});

describe('late cancellation', () => {
  it('exactly at the threshold is not late', () => {
    expect(isLateCancellation(lesson, at('2026-03-09T10:00'), 24)).toBe(false);
  });
  it('one minute inside the threshold is late', () => {
    expect(isLateCancellation(lesson, at('2026-03-09T10:01'), 24)).toBe(true);
  });
  it('uses the configured hours, not a constant', () => {
    expect(isLateCancellation(lesson, at('2026-03-09T10:01'), 12)).toBe(false);
    expect(isLateCancellation(lesson, at('2026-03-07T10:01'), 72)).toBe(true);
    expect(isLateCancellation(lesson, at('2026-03-10T09:59'), 0)).toBe(false);
  });
  it('past / started lessons are not late cancellations', () => {
    expect(isLateCancellation(lesson, at('2026-03-10T10:00'), 24)).toBe(false);
    expect(isLateCancellation(lesson, at('2026-03-11T08:00'), 24)).toBe(false);
    expect(hasStarted(lesson, at('2026-03-10T10:00'))).toBe(true);
  });
  it('normalizes hours', () => {
    expect(normalizeLateHours(undefined)).toBe(24);
    expect(normalizeLateHours('48')).toBe(48);
    expect(normalizeLateHours(-3)).toBe(24);
    expect(normalizeLateHours(0)).toBe(0);
  });
});

describe('canCancel', () => {
  const b = { id: 1, lesson_id: 1, student_id: 5, status: 'confirmed' };
  it('client cannot cancel a started lesson; coach can', () => {
    const now = at('2026-03-10T11:00');
    expect(canCancel({ booking: b, lesson, now }).ok).toBe(false);
    expect(canCancel({ booking: b, lesson, now, isCoach: true }).ok).toBe(true);
  });
  it('cannot cancel twice', () => {
    expect(canCancel({ booking: { ...b, status: 'cancelled' }, lesson, isCoach: true }).ok).toBe(false);
  });
});

describe('labels', () => {
  it('friendly DB errors', () => {
    expect(friendlyBookingError({ message: 'Lesson is full' })).toBe('Lesson is full');
    expect(friendlyBookingError({ code: '23505', message: 'duplicate key value' })).toBe('Student already booked');
    expect(friendlyBookingError({ message: 'boom' })).toBe('Error: boom');
  });
  it('spots text + status', () => {
    expect(spotsText(1)).toBe('1 spot available');
    expect(spotsText(3)).toBe('3 spots available');
    expect(spotsText(0)).toBe('Full');
    expect(bookingStatusInfo({ status: 'cancelled', is_late_cancellation: true }).label).toBe('Late cancel');
    expect(bookingStatusInfo({ status: 'confirmed' }).tone).toBe('info');
  });
});
