import { useEffect, useState } from 'react';
import { useApp } from '../context.jsx';
import EventModal from '../modals/EventModal.jsx';
import RegisterCompetitionModal from '../modals/RegisterCompetitionModal.jsx';
import { EVENT_TYPES } from '../lib/constants.js';
import { formatDate, toISODate } from '../lib/format.js';

const eventType = (id) => EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[0];
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const lastDay = (e) => e.end_date || e.start_date;

export default function EventsView() {
  const { styles: l, data, isCoach, supabase, reload, toast, notify, isMobile, consumeNavParams } = useApp();
  const [editing, setEditing] = useState(undefined); // undefined closed, null new, object edit
  const [registering, setRegistering] = useState(null);
  const [showAllPast, setShowAllPast] = useState(false);
  const [newDate, setNewDate] = useState(null);

  // Deep links from the calendar: {editEventId} | {registerEventId} | {newEvent:true, date}. Read once on mount.
  useEffect(() => {
    const p = consumeNavParams();
    if (!p) return;
    if (p.newEvent && isCoach) {
      setNewDate(/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : null);
      setEditing(null);
    } else if (p.editEventId != null && isCoach) {
      const ev = data.events.find((e) => sameId(e.id, p.editEventId));
      if (ev) setEditing(ev); else toast('Event not found');
    } else if (p.registerEventId != null) {
      const ev = data.events.find((e) => sameId(e.id, p.registerEventId));
      if (!ev) toast('Event not found');
      else if (!ev.is_registrable) toast('Registration is not open for this event');
      else setRegistering(ev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = toISODate(new Date());
  // An event is upcoming until its LAST day has passed (old app dropped multi-day events on their first day).
  const upcoming = data.events.filter((e) => lastDay(e) >= today).sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0));
  const past = data.events.filter((e) => lastDay(e) < today).sort((a, b) => (a.start_date > b.start_date ? -1 : a.start_date < b.start_date ? 1 : 0));
  const myStudentIds = new Set(data.students.map((s) => String(s.id)));
  const registrations = (eventId) => data.bookings.filter((b) => sameId(b.event_id, eventId) && b.status !== 'cancelled');

  const cancelRegistration = async (booking, event) => {
    if (!confirm('Cancel this registration?')) return;
    try {
      const { error } = await supabase.from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (error) throw error;
      if (!isCoach) {
        const s = data.students.find((x) => sameId(x.id, booking.student_id));
        await notify('registration_cancelled', `${s?.name || 'A student'} cancelled registration for ${event.name}`, { eventId: event.id, studentId: booking.student_id });
      }
      await reload();
      toast('Registration cancelled');
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };

  const pastShown = showAllPast ? past : past.slice(0, 10);

  return (
    <div>
      <div style={l.card}>
        <div style={l.cardHeader}>
          <h2 style={l.cardTitle}>Upcoming Events & Competitions</h2>
          {isCoach && <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => { setNewDate(null); setEditing(null); }}>+ Add Event</button>}
        </div>
        {upcoming.length === 0 ? (
          <div style={l.empty}>No upcoming events.</div>
        ) : (
          <div>
            {upcoming.map((ev) => {
              const t = eventType(ev.event_type);
              const regs = registrations(ev.id);
              const venue = data.venues.find((v) => sameId(v.id, ev.venue_id));
              return (
                <div key={ev.id} style={{ ...l.listItem, flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 24 }}>{t.icon}</span>
                        <strong style={{ fontSize: 16 }}>{ev.name}</strong>
                        <span style={{ ...l.badge, background: t.color, color: 'white' }}>{t.name}</span>
                        {ev.is_registrable && <span style={{ ...l.badge, ...l.badgeSuccess }}>Registration open</span>}
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                        {formatDate(ev.start_date)}
                        {ev.end_date && ev.end_date !== ev.start_date && ` - ${formatDate(ev.end_date)}`}
                        {venue && ` • ${venue.name}`}
                      </div>
                      {ev.notes && <div style={{ marginTop: 4, fontSize: 13, whiteSpace: 'pre-wrap' }}>{ev.notes}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', ...(isMobile ? { width: '100%' } : {}) }}>
                      {ev.is_registrable && data.students.length > 0 && (
                        <button style={{ ...l.btn, ...l.btnSuccess }} onClick={() => setRegistering(ev)}>Register Student</button>
                      )}
                      {isCoach && <button style={{ ...l.btn, ...l.btnSecondary }} onClick={() => setEditing(ev)}>Edit</button>}
                    </div>
                  </div>
                  {regs.length > 0 && (
                    <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                      <strong style={{ fontSize: 13 }}>Registered ({regs.length}):</strong>
                      <div style={{ marginTop: 8 }}>
                        {regs.map((b) => {
                          const s = data.students.find((x) => sameId(x.id, b.student_id));
                          const mine = myStudentIds.has(String(b.student_id));
                          return (
                            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                              <span>{s?.name || 'Unknown'}</span>
                              {(isCoach || mine) && (
                                <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => cancelRegistration(b, ev)}>Cancel</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div style={l.card}>
          <div style={l.cardHeader}>
            <h2 style={l.cardTitle}>Past Events</h2>
            {past.length > 10 && (
              <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={() => setShowAllPast(!showAllPast)}>
                {showAllPast ? 'Show recent' : `Show all (${past.length})`}
              </button>
            )}
          </div>
          <div>
            {pastShown.map((ev) => {
              const t = eventType(ev.event_type);
              const count = registrations(ev.id).length;
              return (
                <div key={ev.id} style={l.listItem}>
                  <div>
                    <span style={{ marginRight: 8 }}>{t.icon}</span>
                    <strong>{ev.name}</strong>
                    <span style={{ color: '#64748b', marginLeft: 8 }}>
                      {formatDate(ev.start_date)}
                      {ev.end_date && ev.end_date !== ev.start_date && ` - ${formatDate(ev.end_date)}`}
                    </span>
                    {count > 0 && <span style={{ color: '#64748b', marginLeft: 8, fontSize: 13 }}>• {count} registered</span>}
                  </div>
                  {isCoach && <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={() => setEditing(ev)}>Edit</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing !== undefined && isCoach && <EventModal event={editing} defaultDate={editing ? null : newDate} onClose={() => { setEditing(undefined); setNewDate(null); }} />}
      {registering && <RegisterCompetitionModal event={registering} onClose={() => setRegistering(null)} />}
    </div>
  );
}
