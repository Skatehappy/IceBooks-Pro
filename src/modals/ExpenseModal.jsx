import { useState } from 'react';
import { useApp } from '../context.jsx';
import Modal from '../ui/Modal.jsx';
import { toISODate } from '../lib/format.js';
import { PAYMENT_METHODS, DEFAULT_EXPENSE_CATEGORIES } from '../lib/constants.js';
import { round2 } from '../lib/mileage.js';

const NEW_CATEGORY = '__NEW__';

export default function ExpenseModal({ expense = null, onClose }) {
  const { styles: l, supabase, reload, toast, settings, saveSettings } = useApp();
  const categories = Array.isArray(settings.expense_categories) && settings.expense_categories.length
    ? settings.expense_categories : DEFAULT_EXPENSE_CATEGORIES;
  const [form, setForm] = useState(() => (expense ? {
    date: expense.date,
    category: expense.category || categories[0],
    description: expense.description || '',
    amount: expense.amount ?? '',
    vendor: expense.vendor || '',
    payment_method: expense.payment_method || 'Credit Card',
  } : {
    date: toISODate(new Date()),
    category: categories.includes('Ice Time') ? 'Ice Time' : categories[0],
    description: '', amount: '', vendor: '', payment_method: 'Credit Card',
  }));
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);

  // Keep a category that is no longer in the settings list selectable when editing.
  const options = form.category && !categories.includes(form.category) ? [...categories, form.category] : categories;
  const methods = form.payment_method && !PAYMENT_METHODS.includes(form.payment_method) ? [...PAYMENT_METHODS, form.payment_method] : PAYMENT_METHODS;

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) { toast('Please enter a category name'); return; }
    const existing = categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      setForm({ ...form, category: existing });
    } else {
      try {
        await saveSettings({ expense_categories: [...categories, name] });
        toast('Category added');
        setForm({ ...form, category: name });
      } catch (e) {
        toast('Error: ' + e.message);
        return;
      }
    }
    setAdding(false);
    setNewCat('');
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!form.date) { toast('Please enter a date'); return; }
    if (form.amount === '' || !Number.isFinite(amount) || amount <= 0) { toast('Please enter a valid amount'); return; }
    if (!form.category) { toast('Please select a category'); return; }
    const payload = {
      date: form.date,
      category: form.category,
      description: form.description.trim(),
      amount: round2(amount),
      vendor: form.vendor.trim(),
      payment_method: form.payment_method,
    };
    setBusy(true);
    try {
      if (expense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
      }
      await reload();
      toast(expense ? 'Expense updated' : 'Expense added');
      onClose();
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={expense ? 'Edit Expense' : 'New Expense'}
      onClose={onClose}
      footer={<>
        <button style={{ ...l.btn, ...l.btnSecondary }} onClick={onClose}>Cancel</button>
        <button style={{ ...l.btn, ...l.btnPrimary }} onClick={save} disabled={busy || adding}>Save</button>
      </>}
    >
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Date *</label>
          <input type="date" style={l.input} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Amount *</label>
          <input type="number" style={l.input} step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </div>
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Category</label>
        {adding ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" style={l.input} autoFocus value={newCat} placeholder="New expense category"
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') setAdding(false); }} />
            <button style={{ ...l.btn, ...l.btnPrimary, ...l.btnSmall }} onClick={addCategory}>Add</button>
            <button style={{ ...l.btn, ...l.btnSecondary, ...l.btnSmall }} onClick={() => { setAdding(false); setNewCat(''); }}>Cancel</button>
          </div>
        ) : (
          <select style={l.select} value={form.category}
            onChange={(e) => (e.target.value === NEW_CATEGORY ? setAdding(true) : setForm({ ...form, category: e.target.value }))}>
            {options.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={NEW_CATEGORY}>+ Create New Category...</option>
          </select>
        )}
      </div>
      <div style={l.formGroup}>
        <label style={l.label}>Description</label>
        <input type="text" style={l.input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div style={l.row}>
        <div style={l.formGroup}>
          <label style={l.label}>Vendor</label>
          <input type="text" style={l.input} value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
        </div>
        <div style={l.formGroup}>
          <label style={l.label}>Payment Method</label>
          <select style={l.select} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
