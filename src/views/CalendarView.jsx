import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import LessonModal from '../modals/LessonModal.jsx';
import CopyDayModal from '../modals/CopyDayModal.jsx';
import CopyWeekModal from '../modals/CopyWeekModal.jsx';
import { DAY_NAMES } from '../lib/constants.js';
import { SUPABASE_URL } from '../lib/supabase.js';
import { toISODate, parseLocalDate, formatTime, formatMoney, formatDate, weekDays, monthGrid, downloadBlob } from '../lib/format.js';
import {
  getLessonTypes, findLessonType, findEventType, lessonsOnDate, eventsOnDate, lessonStats, buildPrintScheduleHTML, studentLevelSummary,
} from '../lib/calendar.js';
import {
  activeBookings, spotsLeft, canBook, canCancel, hasStarted, toSpotsMap, isLateCancellation, normalizeLateHours, friendlyBookingError, spotsText, spotsColor,
} from '../lib/booking.js';
import { buildICS, parseICS, planICSImport } from '../lib/ics.js';

/** Calendar for coaches (tab `calendar`) and lesson booking for clients (tab `booking`). */
export default function CalendarView() {
  const { supabase, profile, isCoach, data, settings, reload, toast, notify, nav, isMobile, styles: l } = useApp();
  const { lessons, events, venues, students, clients, bookings } = data;
  const types = useMemo(() => getLessonTypes(settings.custom_lesson_types), [settings.custom_lesson_types]);
  const lateHours = normalizeLateHours(settings.late_cancel_hours);
  const policy = String(settings.cancellation_policy || '').trim();

  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [modal, setModal] = useState(null); // {type:'lesson', id|null, date} | {type:'copyDay', date} | {type:'copyWeek'} | {type:'book', id}
  const [cancelTarget, setCancelTarget] = useState(null); // booking id
  const [busy, setBusy] = useState(false);

  const todayISO = toISODate(new Date());
  const cursorISO = toISODate(cursor);
  const days = weekDays(cursor);
  const grid = monthGrid(cursor);
  // Clients cannot see other families' bookings: load server-side seat counts for the visible range.
  const rangeFrom = view === 'month' ? toISODate(grid[0].date) : view === 'week' ? toISODate(days[0]) : cursorISO;
  const rangeTo = view === 'month' ? toISODate(grid[grid.length - 1].date) : view === 'week' ? toISODate(days[6]) : cursorISO;
  const [spots, setSpots] = useState(null); // Map(lesson_id -> booked) | null (coach / RPC failure -> local bookings)
  useEffect(() => {
    if (isCoach) { setSpots(null); return undefined; }
    let live = true;
    supabase.rpc('lesson_spots', { p_from: rangeFrom, p_to: rangeTo })
      .then(({ data: rows, error }) => {
        if (!live) return;
        if (error) { console.warn('lesson_spots failed; using visible bookings', error); setSpots(null); } else setSpots(toSpotsMap(rows));
      })
      .catch((e) => { if (live) { console.warn('lesson_spots failed', e); setSpots(null); } });
    return () => { live = false; };
  }, [supabase, isCoach, rangeFrom, rangeTo, bookings, lessons]); // bookings/lessons change after every reload (book/cancel)

  const myStudentIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);
  const studentById = (id) => students.find((s) => s.id === id);
  const venueById = (id) => venues.find((v) => v.id === id);
  const lessonById = (id) => lessons.find((x) => x.id === id);

  // ---------- navigation ----------
  const move = (dir) => {
    const d = new Date(cursor);
    if (view === 'month') { d.setDate(1); d.setMonth(d.getMonth() + dir); } else d.setDate(d.getDate() + (view === 'day' ? dir : 7 * dir));
    setCursor(d);
  };
  const goDay = (date) => { setCursor(new Date(date)); setView('day'); };
  const title = view === 'month'
    ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : view === 'day'
      ? cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  // ---------- actions ----------
  const openLesson = (lesson) => {
    if (isCoach) setModal({ type: 'lesson', id: lesson.id });
    else if (lesson.is_published) setModal({ type: 'book', id: lesson.id });
  };
  const newLesson = (date) => setModal({ type: 'lesson', id: null, date: date || cursorISO });
  const onEventClick = (ev) => {
    if (isCoach) nav('events', { editEventId: ev.id });
    else if (ev.event_type === 'competition') nav('events', { registerEventId: ev.id });
  };

  const book = async (lesson, student) => {
    const check = canBook({ lesson, bookings, studentId: student.id, isCoach, spots });
    if (!check.ok) { toast(check.reason); if (check.reason === 'Lesson is full') await reload(); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('bookings')
        .insert({ lesson_id: lesson.id, student_id: student.id, booked_by: profile.id, status: 'confirmed' });
      if (error) {
        const msg = friendlyBookingError(error);
        await reload();
        toast(msg);
        return false;
      }
      if (!isCoach) {
        const t = findLessonType(types, lesson.lesson_type);
        await notify('booking', `${student.name} booked ${t.name} on ${formatDate(lesson.date)} at ${formatTime(lesson.start_time)}`,
          { lessonId: lesson.id, studentId: student.id });
      }
      await reload();
      toast('Lesson booked!');
      return true;
    } catch (e) {
      toast('Error: ' + e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async (booking) => {
    const lesson = lessonById(booking.lesson_id);
    const check = canCancel({ booking, lesson, isCoach });
    if (!check.ok) { toast(check.reason); return; }
    const late = isLateCancellation(lesson, new Date(), lateHours);
    setBusy(true);
    try {
      const { error } = await supabase.from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), is_late_cancellation: late })
        .eq('id', booking.id);
      if (error) throw error;
      if (!isCoach && lesson) {
        const s = studentById(booking.student_id);
        const t = findLessonType(types, lesson.lesson_type);
        await notify('cancellation', `${s?.name || 'A student'} cancelled ${t.name} on ${formatDate(lesson.date)} at ${formatTime(lesson.start_time)}${late ? ' (late cancellation)' : ''}`,
          { lessonId: lesson.id, studentId: booking.student_id });
      }
      await reload();
      toast(late ? `Cancelled (late - within ${lateHours} hours of the lesson, may be billed)` : 'Booking cancelled');
      setCancelTarget(null);
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async (lesson) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
      if (error) throw error;
      await reload();
      toast('Lesson deleted');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const printDay = () => {
    const html = buildPrintScheduleHTML({ date: cursorISO, lessons, bookings, students, clients, venues, lessonTypes: types });
    const w = window.open('', '', 'width=800,height=600');
    if (!w) { toast('Please allow pop-ups to print'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const exportICS = () => {
    const text = buildICS({ lessons, events, bookings, students, venues, lessonTypes: types });
    downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `icebooks-${todayISO}.ics`);
    toast('Calendar exported! Import into Google/Outlook/Apple Calendar.');
  };

  const importICS = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const parsed = parseICS(await file.text());
      const { rows, duplicates } = planICSImport(parsed, events);
      const dupMsg = duplicates > 0 ? `, skipped ${duplicates} duplicate${duplicates !== 1 ? 's' : ''}` : '';
      if (rows.length === 0) {
        toast(parsed.length === 0 ? 'No events found in file.' : `No new events to import${dupMsg}.`);
        return;
      }
      const { error } = await supabase.from('events').insert(rows);
      if (error) throw error;
      await reload();
      toast(`Imported ${rows.length} event${rows.length !== 1 ? 's' : ''}${dupMsg}! Check the Events tab.`);
    } catch (err) {
      toast('Error: ' + err.message);
    } finally {
      input.value = '';
    }
  };

  const copyLiveSync = () => {
    if (!settings.calendar_token) { toast('Calendar token not available yet - reload and try again'); return; }
    const url = `${SUPABASE_URL}/functions/v1/calendar-feed?token=${encodeURIComponent(settings.calendar_token)}`;
    const fallback = () => window.prompt('Copy this URL:', url);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => toast('Live Sync URL copied! Paste into Google Calendar or Outlook.'))
        .catch(fallback);
    } else fallback();
  };

  // ---------- rendering helpers ----------
  const myBookingsOn = (lessonId) => activeBookings(bookings, lessonId).filter((b) => myStudentIds.has(b.student_id));

  const renderDay = (date, outside = false) => {
    const iso = toISODate(date);
    const dayLessons = lessonsOnDate(lessons, iso, isCoach);
    const dayEvents = eventsOnDate(events, iso);
    const compact = view === 'month' && isMobile;
    return (
      <div key={iso}
        style={{ ...l.calendarDay, ...(iso === todayISO ? l.calendarDayToday : {}), opacity: outside ? 0.4 : 1, minHeight: view === 'month' ? (isMobile ? 40 : 80) : 120, minWidth: 0 }}
        onClick={() => (isCoach ? newLesson(iso) : compact ? goDay(date) : null)}>
        <div style={{ ...l.calendarDayNum, cursor: 'pointer' }} title="Open day view"
          onClick={(e) => { e.stopPropagation(); goDay(date); }}>{date.getDate()}</div>
        {compact ? (
          (dayLessons.length > 0 || dayEvents.length > 0) && (
            <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
              {dayEvents.slice(0, 2).map((ev) => <span key={`e-${ev.id}`} style={{ width: 6, height: 6, borderRadius: '50%', background: findEventType(ev.event_type).color }} />)}
              {dayLessons.slice(0, 3).map((x) => <span key={`l-${x.id}`} style={{ width: 6, height: 6, borderRadius: '50%', background: findLessonType(types, x.lesson_type).color }} />)}
            </div>
          )
        ) : (
          <>
            {dayEvents.map((ev) => {
              const et = findEventType(ev.event_type);
              return (
                <div key={`e-${ev.id}`} title={ev.name} style={{ ...l.calendarLesson, background: et.color }}
                  onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}>
                  {et.icon} {view === 'month' ? (isMobile ? '' : ev.name) : ev.name}
                </div>
              );
            })}
            {dayLessons.map((x) => {
              const t = findLessonType(types, x.lesson_type);
              const v = venueById(x.venue_id);
              const active = activeBookings(bookings, x.id);
              const names = active.map((b) => studentById(b.student_id)?.name).filter(Boolean);
              const mine = myBookingsOn(x.id).map((b) => studentById(b.student_id)?.name).filter(Boolean);
              return (
                <div key={`l-${x.id}`} title={`${t.name}${v ? ` @ ${v.name}` : ''}`}
                  style={{ ...l.calendarLesson, background: t.color, opacity: x.is_published ? 1 : 0.5, position: 'relative', paddingRight: v?.color ? 18 : 4, cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); openLesson(x); }}>
                  {formatTime(x.start_time)} {t.icon} {isCoach ? `${active.length}/${x.max_students}` : `${spotsLeft(x, bookings, spots)} open`}
                  {isCoach && names.length > 0 && <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2, fontWeight: 400 }}>{names.join(', ')}</div>}
                  {!isCoach && mine.length > 0 && <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2, fontWeight: 400 }}>✅ {mine.join(', ')}</div>}
                  {v?.color && <span style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: v.color, border: '2px solid rgba(255,255,255,0.8)' }} />}
                </div>
              );
            })}
            {isCoach && dayLessons.length > 0 && (
              <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginTop: 4, width: '100%', fontSize: 10, padding: '4px 6px' }}
                onClick={(e) => { e.stopPropagation(); setModal({ type: 'copyDay', date: iso }); }}>Copy Day</button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderDayView = () => {
    const dayLessons = lessonsOnDate(lessons, cursorISO, isCoach);
    const dayEvents = eventsOnDate(events, cursorISO);
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Schedule for {cursor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          {isCoach && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isMobile && <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => nav('mileage', { newEntryDate: cursorISO })}>⛽ Add Mileage</button>}
              <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => newLesson(cursorISO)}>+ Lesson</button>
              {dayLessons.length > 0 && <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => setModal({ type: 'copyDay', date: cursorISO })}>Copy Day</button>}
              <button style={{ ...l.btn, ...l.btnSecondary }} onClick={printDay}>🖨️ Print</button>
            </div>
          )}
        </div>
        {dayEvents.map((ev) => {
          const et = findEventType(ev.event_type);
          return (
            <div key={`e-${ev.id}`} style={{ ...l.card, borderLeft: `4px solid ${et.color}`, cursor: 'pointer', padding: 16 }} onClick={() => onEventClick(ev)}>
              <div style={{ fontWeight: 600 }}>{et.icon} {ev.name}</div>
              <div style={{ color: '#64748b', fontSize: 14 }}>
                {et.name}{venueById(ev.venue_id) ? ` · 📍 ${venueById(ev.venue_id).name}` : ''}
                {!isCoach && ev.event_type === 'competition' && ' · Tap to register'}
              </div>
            </div>
          );
        })}
        {dayLessons.length === 0 ? (
          <div style={l.empty}>No lessons scheduled for this day</div>
        ) : dayLessons.map((x) => {
          const t = findLessonType(types, x.lesson_type);
          const v = venueById(x.venue_id);
          const active = activeBookings(bookings, x.id);
          const left = spotsLeft(x, bookings, spots);
          const mine = myBookingsOn(x.id);
          return (
            <div key={x.id} style={{ ...l.card, marginBottom: 16, borderLeft: `4px solid ${t.color}`, cursor: 'pointer' }} onClick={() => openLesson(x)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{t.icon} {t.name}</div>
                  <div style={{ color: '#64748b', fontSize: 14 }}>
                    {formatTime(x.start_time)} - {formatTime(x.end_time)}
                    {v && (
                      <span style={{ marginLeft: 12 }}>
                        📍 {v.name}
                        {v.color && <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: v.color, marginLeft: 6, verticalAlign: 'middle' }} />}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
                    {isCoach ? (
                      <>Rate: {formatMoney(x.rate)} | Max: {x.max_students} | Published: {x.is_published ? 'Yes' : 'No'}</>
                    ) : mine.length > 0 ? (
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>✅ Booked: {mine.map((b) => studentById(b.student_id)?.name).join(', ')}</span>
                    ) : (
                      <span style={{ color: spotsColor(left) }}>{spotsText(left)}</span>
                    )}
                  </div>
                </div>
                {isCoach ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={(e) => { e.stopPropagation(); openLesson(x); }}>✏️ Edit</button>
                    <button style={{ ...l.btn, ...l.btnDanger, ...l.btnSmall }} aria-label="Delete lesson" onClick={(e) => { e.stopPropagation(); deleteLesson(x); }}>🗑️</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mine.map((b) => canCancel({ booking: b, lesson: x }).ok && (
                      <button key={b.id} style={{ ...l.btn, ...l.btnDanger, ...l.btnSmall }}
                        onClick={(e) => { e.stopPropagation(); setCancelTarget(b.id); }}>
                        Cancel Booking{mine.length > 1 ? ` (${studentById(b.student_id)?.name})` : ''}
                      </button>
                    ))}
                    {left > 0 && x.is_published && students.some((s) => !mine.some((b) => b.student_id === s.id)) && !hasStarted(x) && (
                      <button style={{ ...l.btn, ...l.btnPrimary, ...l.btnSmall }} onClick={(e) => { e.stopPropagation(); setModal({ type: 'book', id: x.id }); }}>Book</button>
                    )}
                  </div>
                )}
              </div>
              {isCoach && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Booked Students ({active.length}/{x.max_students})</div>
                  {active.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>{x.is_published ? 'No bookings yet' : 'Not published for booking'}</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {active.map((b) => {
                        const s = studentById(b.student_id);
                        const c = clients.find((cl) => cl.id === s?.client_id);
                        return (
                          <div key={b.id} style={{ background: '#f8fafc', padding: 12, borderRadius: 6, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 2fr 1fr', gap: 12 }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>{s?.name || 'Unknown'}</div>
                              <div style={{ fontSize: 13, color: '#64748b' }}>{studentLevelSummary(s)}</div>
                            </div>
                            <div style={{ fontSize: 13 }}>
                              <div style={{ fontWeight: 500 }}>{c?.name}</div>
                              <div style={{ color: '#64748b' }}>{c?.phone}</div>
                              <div style={{ color: '#64748b' }}>{c?.email}</div>
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>
                              Booked: {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}
                              <div style={{ marginTop: 6 }}>
                                <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={() => setCancelTarget(b.id)}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const stats = isCoach ? lessonStats(lessons) : null;
  const viewBtn = (id, label) => (
    <button key={id} style={{ ...l.btn, padding: '6px 12px', borderRadius: 0, background: view === id ? '#7c3aed' : '#f8fafc', color: view === id ? 'white' : '#64748b', border: 'none' }}
      onClick={() => setView(id)}>{label}</button>
  );

  const bookLesson = modal?.type === 'book' ? lessonById(modal.id) : null;
  const editLesson = modal?.type === 'lesson' && modal.id ? lessonById(modal.id) : null;
  const cancelBooking = cancelTarget ? bookings.find((b) => b.id === cancelTarget) : null;

  return (
    <div style={l.card}>
      {isCoach && (
        <div style={l.statsGrid}>
          <div style={l.statCard}><div style={l.statValue}>{stats.monthCount}</div><div style={l.statLabel}>Lessons This Month</div></div>
          <div style={l.statCard}><div style={l.statValue}>{formatMoney(stats.monthRevenue)}</div><div style={l.statLabel}>Revenue This Month</div></div>
          <div style={l.statCard}><div style={l.statValue}>{stats.todayCount}</div><div style={l.statLabel}>Lessons Today</div></div>
          <div style={l.statCard}><div style={l.statValue}>{stats.weekCount}</div><div style={l.statLabel}>This Week</div></div>
        </div>
      )}

      {!isCoach && policy && (
        <div style={{ padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}>
          <strong>Cancellation policy:</strong> {policy}
        </div>
      )}

      <div style={l.calendarHeader}>
        <div style={l.calendarNav}>
          <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => move(-1)}>← Prev</button>
          <h2 style={{ margin: 0, fontSize: isMobile ? 15 : 18 }}>{title}</h2>
          <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => move(1)}>Next →</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={() => setCursor(new Date())}>Today</button>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {viewBtn('month', 'Month')}
            {viewBtn('week', 'Week')}
            {viewBtn('day', 'Day')}
          </div>
          {isCoach && (
            <>
              <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => newLesson(view === 'day' ? cursorISO : todayISO)}>+ Lesson</button>
              <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => nav('events', { newEvent: true, date: view === 'day' ? cursorISO : todayISO })}>+ Event</button>
              <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => setModal({ type: 'copyWeek' })}>Copy Week</button>
            </>
          )}
        </div>
      </div>

      {isCoach && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={exportICS}>📤 Export .ics</button>
          <label style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall, cursor: 'pointer', margin: 0 }}>
            📥 Import .ics
            <input type="file" accept=".ics,.ical,text/calendar" onChange={importICS} style={{ display: 'none' }} />
          </label>
          <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={copyLiveSync}>🔗 Live Sync URL</button>
        </div>
      )}

      {view !== 'day' && (
        <div style={{ ...l.calendarGrid, gap: isMobile ? 2 : 4 }}>
          {DAY_NAMES.map((d) => <div key={d} style={{ ...l.calendarDayHeader, padding: isMobile ? 4 : 8 }}>{isMobile ? d.charAt(0) : d}</div>)}
          {view === 'month' ? grid.map(({ date, outside }) => renderDay(date, outside)) : days.map((d) => renderDay(d))}
        </div>
      )}
      {view === 'day' && renderDayView()}

      {modal?.type === 'lesson' && (
        <LessonModal key={modal.id || 'new'} lesson={editLesson} date={modal.date} onClose={() => setModal(null)}
          onCancelBooking={(b) => setCancelTarget(b.id)} />
      )}
      {modal?.type === 'copyDay' && <CopyDayModal date={modal.date} onClose={() => setModal(null)} />}
      {modal?.type === 'copyWeek' && <CopyWeekModal date={cursorISO} onClose={() => setModal(null)} />}
      {bookLesson && (
        <BookingModal lesson={bookLesson} types={types} spots={spots} busy={busy} policy={policy} lateHours={lateHours}
          onBook={async (s) => { if (await book(bookLesson, s)) setModal(null); }}
          onCancel={(b) => setCancelTarget(b.id)} onClose={() => setModal(null)} />
      )}
      {cancelBooking && (
        <CancelModal booking={cancelBooking} lesson={lessonById(cancelBooking.lesson_id)} student={studentById(cancelBooking.student_id)}
          types={types} policy={policy} lateHours={lateHours} isCoach={isCoach} busy={busy}
          onConfirm={() => doCancel(cancelBooking)} onClose={() => setCancelTarget(null)} />
      )}
    </div>
  );
}

function LessonSummary({ lesson, types }) {
  const { data } = useApp();
  const t = findLessonType(types, lesson.lesson_type);
  const v = data.venues.find((x) => x.id === lesson.venue_id);
  return (
    <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
      <strong>{parseLocalDate(lesson.date).toLocaleDateString()}</strong><br />
      {formatTime(lesson.start_time)} - {formatTime(lesson.end_time)}<br />
      {t.icon} {t.name}<br />
      {v?.name || 'TBD'}
    </div>
  );
}

/** Client (or coach) booking modal: pick one of the user's students; shows own bookings + policy. */
function BookingModal({ lesson, types, spots, busy, policy, lateHours, onBook, onCancel, onClose }) {
  const { data, isCoach, styles: l } = useApp();
  const { students, bookings } = data;
  const active = activeBookings(bookings, lesson.id);
  const bookedIds = new Set(active.map((b) => b.student_id));
  const left = spotsLeft(lesson, bookings, spots);
  const available = students.filter((s) => !bookedIds.has(s.id));
  const mine = active.filter((b) => students.some((s) => s.id === b.student_id));
  const started = !isCoach && hasStarted(lesson);

  let body;
  if (started) body = <div style={{ padding: 12, background: '#f1f5f9', borderRadius: 8, color: '#475569' }}>This lesson has already started.</div>;
  else if (left <= 0) body = <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, color: '#92400e' }}>This lesson is full.</div>;
  else if (students.length === 0) body = <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, color: '#92400e' }}>No students on your account yet. Add one in My Students first.</div>;
  else if (available.length === 0) body = <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, color: '#166534' }}>All your students are already booked.</div>;
  else {
    body = available.map((s) => (
      <button key={s.id} disabled={busy} style={{ ...l.btn, ...l.btnPrimary, textAlign: 'left' }}
        onClick={async () => { await onBook(s); }}>Book {s.name}</button>
    ));
  }

  return (
    <Modal title="Book Lesson" onClose={onClose}>
      <LessonSummary lesson={lesson} types={types} />
      {mine.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {mine.map((b) => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, marginBottom: 6, gap: 8 }}>
              <span style={{ color: '#166534', fontWeight: 600 }}>✅ {students.find((s) => s.id === b.student_id)?.name} is booked</span>
              {canCancel({ booking: b, lesson, isCoach }).ok && (
                <button style={{ ...l.btn, ...l.btnDanger, ...l.btnSmall }} onClick={() => onCancel(b)}>Cancel Booking</button>
              )}
            </div>
          ))}
        </div>
      )}
      <div style={l.formGroup}>
        <label style={l.label}>Select Student to Book</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{body}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
          {left} of {lesson.max_students} spot{Number(lesson.max_students) !== 1 ? 's' : ''} available
        </div>
      </div>
      {(policy || lateHours > 0) && (
        <div style={{ fontSize: 12, color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: 12, whiteSpace: 'pre-wrap' }}>
          {lateHours > 0 && <div>Cancellations within {lateHours} hours of the lesson are late cancellations and may be billed.</div>}
          {policy && <div style={{ marginTop: 4 }}><strong>Cancellation policy:</strong> {policy}</div>}
        </div>
      )}
    </Modal>
  );
}

/** Confirm a cancellation, warning when it will be a late cancellation. */
function CancelModal({ booking, lesson, student, types, policy, lateHours, isCoach, busy, onConfirm, onClose }) {
  const { styles: l } = useApp();
  const late = isLateCancellation(lesson, new Date(), lateHours);
  const footer = (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Keep Booking</button>
      <button style={{ ...l.btn, ...l.btnDanger }} disabled={busy} onClick={onConfirm}>Cancel Booking</button>
    </>
  );
  return (
    <Modal title="Cancel Booking" onClose={onClose} footer={footer}>
      {lesson && <LessonSummary lesson={lesson} types={types} />}
      <p style={{ marginTop: 0 }}>Cancel the booking for <strong>{student?.name || 'this student'}</strong>?</p>
      {late && (
        <div style={{ ...l.error, background: '#fef3c7', color: '#92400e' }}>
          ⚠️ This lesson starts in less than {lateHours} hours. This is a late cancellation and {isCoach ? 'the client' : 'you'} may be billed.
        </div>
      )}
      {policy && (
        <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap' }}><strong>Cancellation policy:</strong> {policy}</div>
      )}
      {booking.status === 'completed' && <p style={{ fontSize: 13, color: '#64748b' }}>Note: this booking is marked completed.</p>}
    </Modal>
  );
}
