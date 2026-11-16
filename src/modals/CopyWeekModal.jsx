import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { planCopyWeek } from '../lib/calendar.js';
import { parseLocalDate } from '../lib/format.js';

/** Copy the Sun..Sat week containing `date` (YYYY-MM-DD) to the next N weeks. */
export default function CopyWeekModal({ date, onClose }) {
  const { supabase, data, reload, toast, styles: l } = useApp();
  const [weeks, setWeeks] = useState(1);
  const [busy, setBusy] = useState(false);
  const preview = planCopyWeek(data.lessons, date, weeks);
  const fmt = (iso) => parseLocalDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const copy = async () => {
    const plan = planCopyWeek(data.lessons, date, weeks);
    if (plan.sourceCount === 0) { toast('No lessons to copy'); return; }
    setBusy(true);
    try {
      if (plan.inserts.length) {
        const { error } = await supabase.from('lessons').insert(plan.inserts);
        if (error) throw error;
      }
      await reload();
      toast(`Copied ${plan.inserts.length} lessons to ${weeks} week(s)${plan.skipped > 0 ? `, skipped ${plan.skipped} conflicts` : ''}`);
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
      <button style={{ ...l.btn, ...l.btnPrimary }} onClick={copy} disabled={busy}>Copy to {weeks} Week{weeks !== 1 ? 's' : ''}</button>
    </>
  );

  return (
    <Modal title="Copy Week" onClose={onClose} footer={footer}>
      <p style={{ marginBottom: 16 }}>
        Copy this week's schedule ({fmt(preview.start)} - {fmt(preview.end)}, {preview.sourceCount} lesson{preview.sourceCount !== 1 ? 's' : ''}) to future weeks:
      </p>
      <div style={l.formGroup}>
        <label style={l.label}>Number of weeks to copy ahead</label>
        <select style={l.select} value={weeks} onChange={(e) => setWeeks(parseInt(e.target.value, 10))}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} week{n !== 1 ? 's' : ''}</option>)}
        </select>
      </div>
      <p style={{ fontSize: 13, color: '#64748b' }}>Copied lessons will be unpublished (drafts). Conflicts will be skipped.</p>
    </Modal>
  );
}
