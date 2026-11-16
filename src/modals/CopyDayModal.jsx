import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { DAY_NAMES } from '../lib/constants.js';
import { parseLocalDate, toISODate, weekDays } from '../lib/format.js';
import { planCopyDay } from '../lib/calendar.js';

/** Copy all lessons of `date` (YYYY-MM-DD) to other days of the same week. */
export default function CopyDayModal({ date, onClose }) {
  const { supabase, data, reload, toast, styles: l } = useApp();
  const [targets, setTargets] = useState([]); // ISO dates
  const [busy, setBusy] = useState(false);
  const source = parseLocalDate(date);
  const days = weekDays(source);

  const copy = async () => {
    if (targets.length === 0) return;
    const plan = planCopyDay(data.lessons, date, targets);
    if (plan.sourceCount === 0) { toast('No lessons to copy'); return; }
    setBusy(true);
    try {
      if (plan.inserts.length) {
        const { error } = await supabase.from('lessons').insert(plan.inserts);
        if (error) throw error;
      }
      await reload();
      toast(`Copied ${plan.inserts.length} lessons${plan.skipped > 0 ? `, skipped ${plan.skipped} conflicts` : ''}`);
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={copy} disabled={targets.length === 0 || busy}>
        Copy to {targets.length} Day{targets.length !== 1 ? 's' : ''}
      </button>
    </>
  );

  return (
    <Modal title="Copy Day" onClose={onClose} footer={footer}>
      <p style={{ marginBottom: 16 }}>Copy all lessons from <strong>{source.toLocaleDateString()}</strong> to:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {days.map((d, i) => {
          const iso = toISODate(d);
          const isSource = iso === date;
          const selected = targets.includes(iso);
          return (
            <button key={iso} disabled={isSource} aria-pressed={selected}
              style={{ ...l.btn, ...(selected ? l.btnPrimary : l.btnSecondary), opacity: isSource ? 0.5 : 1 }}
              onClick={() => setTargets(selected ? targets.filter((t) => t !== iso) : [...targets, iso])}>
              {DAY_NAMES[i]}<br /><span style={{ fontSize: 12 }}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <p style={{ marginTop: 16, fontSize: 13, color: '#64748b' }}>
        Copied lessons will be unpublished (drafts). Conflicts will be skipped.
      </p>
    </Modal>
  );
}
