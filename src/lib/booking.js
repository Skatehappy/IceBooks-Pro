// Pure booking rules: capacity, eligibility, late-cancellation detection, labels/colours.
import { DEFAULT_LATE_CANCEL_HOURS } from './constants.js';
import { parseLocalDate } from './format.js';

/** Non-cancelled bookings of a lesson. */
export const activeBookings = (bookings, lessonId) =>
  (bookings || []).filter((b) => b.lesson_id === lessonId && b.status !== 'cancelled');

/** Rows of rpc('lesson_spots') -> Map(lesson_id -> booked count). Bad rows are ignored. */
export const toSpotsMap = (rows) => {
  const m = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = Number(r?.lesson_id);
    const booked = Number(r?.booked);
    if (Number.isFinite(id) && Number.isFinite(booked)) m.set(id, booked);
  }
  return m;
};

/**
 * Booked seats for a lesson. With a spots map (client role, from lesson_spots) the server count is used;
 * never lower than what the caller can see locally. Without one (coach / RPC failure) -> visible bookings.
 */
export const bookedCount = (lesson, bookings, spots = null) => {
  const local = activeBookings(bookings, lesson.id).length;
  const id = Number(lesson.id);
  return spots && spots.has(id) ? Math.max(spots.get(id), local) : local;
};

/** Remaining capacity (never negative). */
export const spotsLeft = (lesson, bookings, spots = null) =>
  lesson ? Math.max(0, (Number(lesson.max_students) || 0) - bookedCount(lesson, bookings, spots)) : 0;

export const isFull = (lesson, bookings, spots = null) => spotsLeft(lesson, bookings, spots) <= 0;

/** Local Date of the lesson start. */
export const lessonStart = (lesson) => {
  const d = parseLocalDate(lesson.date);
  const [h = '0', m = '0'] = String(lesson.start_time || '00:00').split(':');
  d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
  return d;
};

export const hoursUntilLesson = (lesson, now = new Date()) => (lessonStart(lesson) - now) / 3600000;

export const hasStarted = (lesson, now = new Date()) => hoursUntilLesson(lesson, now) <= 0;

/** settings.late_cancel_hours -> number of hours (0 allowed = never late; invalid -> default 24). */
export const normalizeLateHours = (v) => {
  if (v === '' || v == null) return DEFAULT_LATE_CANCEL_HOURS;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LATE_CANCEL_HOURS;
};

/**
 * A cancellation is late when the lesson starts in the future but less than `lateHours` from now.
 * Exactly `lateHours` before the start is NOT late; lessons already started/past are not "late cancellations".
 */
export const isLateCancellation = (lesson, now = new Date(), lateHours = DEFAULT_LATE_CANCEL_HOURS) => {
  if (!lesson) return false;
  const h = hoursUntilLesson(lesson, now);
  return h > 0 && h < normalizeLateHours(lateHours);
};

/** Can `studentId` be booked onto `lesson`? -> { ok: true } | { ok: false, reason } */
export const canBook = ({ lesson, bookings, studentId, isCoach = false, now = new Date(), spots = null }) => {
  if (!lesson) return { ok: false, reason: 'Lesson not found' };
  if (!studentId) return { ok: false, reason: 'Please select a student' };
  if (!isCoach && !lesson.is_published) return { ok: false, reason: 'This lesson is not open for booking' };
  if (!isCoach && hasStarted(lesson, now)) return { ok: false, reason: 'This lesson has already started' };
  const active = activeBookings(bookings, lesson.id);
  if (active.some((b) => b.student_id === studentId)) return { ok: false, reason: 'Student already booked' };
  if (bookedCount(lesson, bookings, spots) >= (Number(lesson.max_students) || 0)) return { ok: false, reason: 'Lesson is full' };
  return { ok: true };
};

/** Can this booking be cancelled by the current user? Clients cannot cancel once the lesson started. */
export const canCancel = ({ booking, lesson, isCoach = false, now = new Date() }) => {
  if (!booking) return { ok: false, reason: 'Booking not found' };
  if (booking.status === 'cancelled') return { ok: false, reason: 'Booking already cancelled' };
  if (!isCoach && booking.status === 'completed') return { ok: false, reason: 'This lesson is already completed' };
  if (!isCoach && lesson && hasStarted(lesson, now)) {
    return { ok: false, reason: 'This lesson has already started - please contact your coach' };
  }
  return { ok: true };
};

/** Map DB errors (capacity / duplicate triggers) to friendly text. */
export const friendlyBookingError = (err) => {
  const msg = String(err?.message || err || '');
  const low = msg.toLowerCase();
  if (low.includes('full') || low.includes('capacity') || low.includes('max_students')) return 'Lesson is full';
  if (err?.code === '23505' || low.includes('already') || low.includes('duplicate') || low.includes('unique')) {
    return 'Student already booked';
  }
  return 'Error: ' + msg;
};

export const spotsText = (left) => (left > 0 ? `${left} spot${left !== 1 ? 's' : ''} available` : 'Full');
export const spotsColor = (left) => (left > 0 ? '#3b82f6' : '#9ca3af');

const STATUS = {
  confirmed: { label: 'Confirmed', tone: 'info', color: '#3b82f6' },
  completed: { label: 'Completed', tone: 'success', color: '#22c55e' },
  cancelled: { label: 'Cancelled', tone: 'danger', color: '#ef4444' },
};
/** { label, tone ('info'|'success'|'warning'|'danger'), color } for a booking. */
export const bookingStatusInfo = (b) => {
  if (b?.status === 'cancelled' && b.is_late_cancellation) return { label: 'Late cancel', tone: 'warning', color: '#f59e0b' };
  return STATUS[b?.status] || { label: String(b?.status || ''), tone: 'info', color: '#64748b' };
};
