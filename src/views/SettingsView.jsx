import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context.jsx';
import { SUPABASE_URL } from '../lib/supabase.js';
import { DEFAULT_LESSON_TYPES, DEFAULT_MILEAGE_RATE, DEFAULT_LATE_CANCEL_HOURS } from '../lib/constants.js';
import { formatMoney } from '../lib/format.js';

const FIELDS = [
  'payment_cash', 'payment_check', 'payment_venmo', 'payment_paypal', 'payment_zelle', 'payment_cashapp',
  'coach_name', 'coach_email', 'coach_phone', 'coach_address',
  'mileage_rate', 'vehicle_expense_method', 'expense_categories', 'custom_lesson_types',
  'late_cancel_hours', 'cancellation_policy',
];

const toForm = (s) => {
  const f = {};
  FIELDS.forEach((k) => { f[k] = s?.[k]; });
  f.payment_cash = !!f.payment_cash;
  f.payment_check = !!f.payment_check;
  ['payment_venmo', 'payment_paypal', 'payment_zelle', 'payment_cashapp', 'coach_name', 'coach_email', 'coach_phone', 'coach_address', 'cancellation_policy']
    .forEach((k) => { f[k] = f[k] || ''; });
  f.mileage_rate = f.mileage_rate ?? DEFAULT_MILEAGE_RATE;
  f.vehicle_expense_method = f.vehicle_expense_method || 'standard';
  f.expense_categories = Array.isArray(f.expense_categories) ? f.expense_categories : [];
  f.custom_lesson_types = Array.isArray(f.custom_lesson_types) ? f.custom_lesson_types : [];
  f.late_cancel_hours = f.late_cancel_hours ?? DEFAULT_LATE_CANCEL_HOURS;
  return f;
};

const NEW_TYPE = { name: '', icon: '📚', color: '#3b82f6', max: 1, rate: 50 };

export default function SettingsView() {
  const { settings, saveSettings, styles: l, isMobile, toast } = useApp();
  const [form, setForm] = useState(() => toForm(settings));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(''); // '' | 'saving' | 'saved'
  const [newCat, setNewCat] = useState('');
  const [newType, setNewType] = useState(NEW_TYPE);
  const lastKey = useRef('');

  // Re-hydrate from settings when they change (but never clobber unsaved edits).
  useEffect(() => {
    const key = JSON.stringify(toForm(settings));
    if (key === lastKey.current) return;
    if (!dirty) { setForm(toForm(settings)); lastKey.current = key; }
  }, [settings, dirty]);

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); setStatus(''); };

  const save = async () => {
    const rate = Number(form.mileage_rate);
    if (!Number.isFinite(rate) || rate < 0) { toast('Mileage rate must be a number ≥ 0'); return; }
    const hours = Number(form.late_cancel_hours);
    if (!Number.isInteger(hours) || hours < 0 || hours > 720) { toast('Late-cancel window must be a whole number of hours (0–720)'); return; }
    const patch = {
      ...form,
      payment_venmo: form.payment_venmo.trim(), payment_paypal: form.payment_paypal.trim(),
      payment_zelle: form.payment_zelle.trim(), payment_cashapp: form.payment_cashapp.trim(),
      coach_name: form.coach_name.trim(), coach_email: form.coach_email.trim(),
      coach_phone: form.coach_phone.trim(), coach_address: form.coach_address.trim(),
      mileage_rate: rate, late_cancel_hours: hours,
    };
    setStatus('saving');
    try {
      const saved = await saveSettings(patch);
      lastKey.current = JSON.stringify(toForm(saved));
      setForm(toForm(saved));
      setDirty(false);
      setStatus('saved');
      toast('Settings saved');
    } catch (e) {
      setStatus('');
      toast('Error: ' + e.message);
    }
  };

  const revert = () => { setForm(toForm(settings)); setDirty(false); setStatus(''); };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (form.expense_categories.some((x) => x.toLowerCase() === c.toLowerCase())) { toast('That category already exists'); return; }
    set({ expense_categories: [...form.expense_categories, c] });
    setNewCat('');
  };
  const removeCategory = (c) => set({ expense_categories: form.expense_categories.filter((x) => x !== c) });

  const addType = () => {
    if (!newType.name.trim()) { toast('Please enter a name'); return; }
    const t = {
      id: 'custom_' + Date.now(), name: newType.name.trim(), icon: newType.icon || '📚', color: newType.color || '#3b82f6',
      max: Math.max(1, parseInt(newType.max, 10) || 1), rate: Math.max(0, Math.round((parseFloat(newType.rate) || 0) * 100) / 100),
    };
    set({ custom_lesson_types: [...form.custom_lesson_types, t] });
    setNewType(NEW_TYPE);
  };
  const removeType = (id) => {
    if (!confirm('Remove this lesson type? Existing lessons keep their type id.')) return;
    set({ custom_lesson_types: form.custom_lesson_types.filter((t) => t.id !== id) });
  };

  const feedUrl = settings.calendar_token ? `${SUPABASE_URL}/functions/v1/calendar-feed?token=${settings.calendar_token}` : '';
  const copyFeed = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl)
      .then(() => toast('Live Sync URL copied! Paste into Google Calendar or Outlook.'))
      .catch(() => prompt('Copy this URL:', feedUrl));
  };

  const h3 = { fontSize: 16, fontWeight: 600, marginBottom: 16 };
  const hint = { fontSize: 14, color: '#64748b', marginBottom: 16 };
  const small = { fontSize: 12, color: '#64748b', marginTop: 4 };
  const section = { borderTop: '1px solid #e2e8f0', paddingTop: 24, marginBottom: 24 };
  const chk = { display: 'flex', alignItems: 'center', cursor: 'pointer' };
  const text = (k, label, props = {}) => (
    <div style={l.formGroup}>
      <label style={l.label}>{label}</label>
      <input type="text" style={l.input} value={form[k]} onChange={(e) => set({ [k]: e.target.value })} {...props} />
    </div>
  );

  const saveBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {status === 'saved' && !dirty && <span style={{ color: '#10b981', fontWeight: 600 }}>Saved ✓</span>}
      {dirty && <span style={{ color: '#92400e', fontSize: 13 }}>Unsaved changes</span>}
      {dirty && <button style={{ ...l.btn, ...l.btnSecondary }} onClick={revert} disabled={status === 'saving'}>Discard</button>}
      <button style={{ ...l.btn, ...l.btnPrimary, opacity: status === 'saving' ? 0.6 : 1 }} onClick={save} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );

  return (
    <div style={l.card}>
      <div style={l.cardHeader}>
        <h2 style={l.cardTitle}>Settings</h2>
        {saveBar}
      </div>

      <div style={{ marginBottom: 24 }}>
        <h3 style={h3}>👤 Coach Profile</h3>
        <p style={hint}>Your contact info appears on invoices and is used when emailing/texting clients.</p>
        <div style={l.row}>
          {text('coach_name', 'Coach / Business Name', { placeholder: 'Your name or business name' })}
          {text('coach_email', 'Email', { type: 'email', placeholder: 'your@email.com' })}
        </div>
        <div style={l.row}>
          {text('coach_phone', 'Phone', { type: 'tel', placeholder: '(555) 555-5555' })}
          {text('coach_address', 'Address (for invoices)', { placeholder: 'City, State' })}
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>💳 Payment Methods</h3>
        <p style={hint}>Configure your accepted payment methods. These will be included on invoices.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
          <label style={chk}><input type="checkbox" checked={form.payment_cash} onChange={(e) => set({ payment_cash: e.target.checked })} style={{ marginRight: 8 }} />Accept Cash</label>
          <label style={chk}><input type="checkbox" checked={form.payment_check} onChange={(e) => set({ payment_check: e.target.checked })} style={{ marginRight: 8 }} />Accept Check</label>
        </div>
        <div style={l.row}>
          {text('payment_venmo', 'Venmo Username', { placeholder: '@username' })}
          {text('payment_paypal', 'PayPal Email', { placeholder: 'email@example.com' })}
        </div>
        <div style={l.row}>
          {text('payment_zelle', 'Zelle (phone or email)', { placeholder: 'phone or email' })}
          {text('payment_cashapp', 'Cash App Tag', { placeholder: '$cashtag' })}
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>🚫 Cancellation Policy</h3>
        <p style={hint}>Clients see this policy when booking. Cancellations inside the window are late cancellations and can be billed.</p>
        <div style={l.formGroup}>
          <label style={l.label}>Late cancellation window (hours before the lesson)</label>
          <input type="number" min="0" max="720" step="1" style={{ ...l.input, maxWidth: 150 }} value={form.late_cancel_hours}
            onChange={(e) => set({ late_cancel_hours: e.target.value === '' ? '' : Number(e.target.value) })} />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Policy text</label>
          <textarea style={l.textarea} value={form.cancellation_policy} onChange={(e) => set({ cancellation_policy: e.target.value })}
            placeholder={`e.g. Lessons cancelled less than ${form.late_cancel_hours || 24} hours in advance are billed at the full rate.`} />
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>🚗 Mileage & Vehicle Settings</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={l.label}>Vehicle Expense Method</label>
          <select style={l.input} value={form.vehicle_expense_method} onChange={(e) => set({ vehicle_expense_method: e.target.value })}>
            <option value="standard">Standard Mileage Rate</option>
            <option value="actual">Actual Expenses</option>
          </select>
          <div style={small}>
            {form.vehicle_expense_method === 'standard'
              ? 'Uses the IRS standard mileage rate to calculate deductions automatically.'
              : 'Tracks actual vehicle expenses (gas, maintenance, etc.).'}
          </div>
        </div>
        {form.vehicle_expense_method === 'standard' && (
          <div>
            <label style={l.label}>Standard Mileage Rate (per mile)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>$</span>
              <input type="number" step="0.005" min="0" style={{ ...l.input, maxWidth: 150 }} value={form.mileage_rate}
                onChange={(e) => set({ mileage_rate: e.target.value })} />
            </div>
            <div style={small}>Current IRS standard mileage rate for 2026 is $0.725 per mile.</div>
          </div>
        )}
      </div>

      <div style={section}>
        <h3 style={h3}>🏷️ Expense Categories</h3>
        <p style={hint}>Categories offered when adding expenses (you can also create one from the expense form).</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {form.expense_categories.length === 0 && <span style={{ color: '#64748b', fontSize: 14 }}>No categories.</span>}
          {form.expense_categories.map((c) => (
            <span key={c} style={{ ...l.badge, ...l.badgeInfo, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {c}
              <button onClick={() => removeCategory(c)} aria-label={`Remove ${c}`}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#1e40af', padding: 0, fontSize: 13 }}>✕</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
          <input style={l.input} value={newCat} placeholder="New category" onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} />
          <button style={{ ...l.btn, ...l.btnSecondary, whiteSpace: 'nowrap' }} onClick={addCategory}>+ Add</button>
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>📚 Lesson Types</h3>
        <p style={hint}>Built-in types: {DEFAULT_LESSON_TYPES.map((t) => `${t.icon} ${t.name} (${formatMoney(t.rate)}, max ${t.max})`).join(' · ')}</p>
        {form.custom_lesson_types.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>No custom lesson types yet.</div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            {form.custom_lesson_types.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: t.color, display: 'inline-block' }} />
                  {t.icon} <strong>{t.name}</strong>
                  <span style={{ color: '#64748b', fontSize: 13 }}>{formatMoney(t.rate)} · max {t.max}</span>
                </span>
                <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => removeType(t.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 70px 70px 90px 100px auto', gap: 8, alignItems: 'end' }}>
          <div><label style={l.label}>Name</label><input style={l.input} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} placeholder="e.g. Jump Clinic" /></div>
          <div><label style={l.label}>Icon</label><input style={l.input} value={newType.icon} onChange={(e) => setNewType({ ...newType, icon: e.target.value })} /></div>
          <div><label style={l.label}>Color</label><input type="color" style={{ ...l.input, padding: 2, height: 40 }} value={newType.color} onChange={(e) => setNewType({ ...newType, color: e.target.value })} /></div>
          <div><label style={l.label}>Max</label><input type="number" min="1" style={l.input} value={newType.max} onChange={(e) => setNewType({ ...newType, max: e.target.value })} /></div>
          <div><label style={l.label}>Rate ($)</label><input type="number" min="0" step="0.01" style={l.input} value={newType.rate} onChange={(e) => setNewType({ ...newType, rate: e.target.value })} /></div>
          <button style={{ ...l.btn, ...l.btnSecondary, whiteSpace: 'nowrap' }} onClick={addType}>+ Add Type</button>
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>🔗 Live Sync Calendar</h3>
        <p style={hint}>Subscribe to this URL in Google Calendar, Outlook or Apple Calendar to see your lessons and events. Keep it private.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <input style={{ ...l.input, background: '#f8fafc' }} readOnly value={feedUrl || 'Not available yet — reload after your settings are created.'} onFocus={(e) => e.target.select()} />
          <button style={{ ...l.btn, ...l.btnSecondary, whiteSpace: 'nowrap' }} onClick={copyFeed} disabled={!feedUrl}>📋 Copy</button>
        </div>
      </div>

      <div style={section}>
        <h3 style={h3}>📧 Send Invoices</h3>
        <p style={{ fontSize: 14, color: '#64748b' }}>
          Invoices are emailed to clients directly from the Invoices tab with 📧 Email. If email sending isn’t configured yet, you can open
          the invoice in your own email app instead, or use 💬 Text / 📋 Copy.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{saveBar}</div>
    </div>
  );
}
