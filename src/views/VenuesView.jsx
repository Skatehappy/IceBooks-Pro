import { useState } from 'react';
import { useApp } from '../context.jsx';
import VenueModal, { deleteVenue, DEFAULT_VENUE_COLOR } from '../modals/VenueModal.jsx';

export default function VenuesView() {
  const app = useApp();
  const { styles: l, data, isMobile } = app;
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Venues / Rinks</h2>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => setEditing(null)}>+ Add Venue</button>
      </div>
      {data.venues.length === 0 ? (
        <div style={l.empty}>No venues yet. Add your rinks!</div>
      ) : (
        <div>
          {data.venues.map((v) => (
            <div key={v.id} style={{ ...l.listItem, ...(isMobile ? { flexDirection: 'column', alignItems: 'flex-start', gap: 8 } : {}) }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span title="Calendar color" style={{ width: 14, height: 14, borderRadius: '50%', background: v.color || DEFAULT_VENUE_COLOR, marginTop: 4, flexShrink: 0 }} />
                <div>
                  <strong>{v.name}</strong>
                  {v.address && <div style={{ color: '#64748b', fontSize: 13 }}>{v.address}</div>}
                </div>
              </div>
              <div style={{ whiteSpace: 'nowrap' }}>
                <button style={{ ...l.btn, ...l.btnSmall, ...l.btnSecondary, marginRight: 8 }} onClick={() => setEditing(v)}>Edit</button>
                <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => deleteVenue(app, v.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing !== undefined && <VenueModal venue={editing} onClose={() => setEditing(undefined)} />}
    </div>
  );
}
