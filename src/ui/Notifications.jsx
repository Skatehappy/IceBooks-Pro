import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context.jsx';

/** Coach notifications bell + dropdown panel (client role renders nothing). Mounted by the lead in the header. */
export default function Notifications() {
  const { styles: l, data, isCoach, supabase, reload, toast, profile, isMobile } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!isCoach) return null;
  const list = data.notifications || [];
  const unread = list.filter((n) => !n.read).length;

  const markRead = async (id) => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
    if (error) toast('Error: ' + error.message);
    else await reload();
  };
  const markAllRead = async () => {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false).eq('coach_id', profile.id);
    if (error) toast('Error: ' + error.message);
    else await reload();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall, position: 'relative' }}
        onClick={() => setOpen(!open)}
        aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
      >
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: 'white', borderRadius: '50%', minWidth: 20, height: 20, padding: '0 4px', boxSizing: 'border-box', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'white', color: '#0f172a',
          border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          width: isMobile ? 'min(320px, calc(100vw - 32px))' : 320, maxHeight: 400, overflow: 'auto', zIndex: 1000,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Notifications</strong>
            {unread > 0 && (
              <button style={{ ...l.btn, ...l.btnSecondary, padding: '4px 8px', fontSize: 12 }} onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          {list.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No notifications</div>
          ) : (
            list.map((n) => (
              <div
                key={n.id}
                style={{ padding: 12, borderBottom: '1px solid #f1f5f9', background: n.read ? 'white' : '#f0f9ff', cursor: n.read ? 'default' : 'pointer' }}
                onClick={() => !n.read && markRead(n.id)}
              >
                <div style={{ fontSize: 14, marginBottom: 4 }}>{n.message}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
