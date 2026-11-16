import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context.jsx';
import InvoiceModal from '../modals/InvoiceModal.jsx';
import PaymentModal from '../modals/PaymentModal.jsx';
import { PAYMENT_METHODS } from '../lib/constants.js';
import { formatMoney, formatDate, toISODate } from '../lib/format.js';
import {
  totalOf, paidOf, balanceDue, isOverdue, emailText, mailtoHref, smsText, smsHref, clipboardText, printHtml,
  interpretSendResult, lessonTypeFor, sumCents,
} from '../lib/invoice.js';

const STATUS_FILTERS = ['all', 'outstanding', 'draft', 'sent', 'partial', 'overdue', 'paid', 'void'];

export default function InvoicesView() {
  const { supabase, data, settings, profile, styles: l, isMobile, reload, toast, consumeNavParams } = useApp();
  const pays = data.invoicePayments;
  const [createFor, setCreateFor] = useState(null); // null = closed; '' or client id = open
  const [paying, setPaying] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [mailtoFallback, setMailtoFallback] = useState({}); // invoice id -> true when Resend isn't configured
  const [sending, setSending] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const p = consumeNavParams();
    if (p?.clientId != null) {
      setClientFilter(String(p.clientId));
      if (p.create !== false) setCreateFor(String(p.clientId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientById = useMemo(() => new Map(data.clients.map((c) => [c.id, c])), [data.clients]);
  const today = toISODate(new Date());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.invoices.filter((inv) => {
      if (clientFilter && String(inv.client_id) !== clientFilter) return false;
      if (statusFilter === 'overdue' && !isOverdue(inv, today, pays)) return false;
      if (statusFilter === 'outstanding' && !(['draft', 'sent', 'partial'].includes(inv.status) && balanceDue(inv, pays) > 0)) return false;
      if (!['all', 'overdue', 'outstanding'].includes(statusFilter) && inv.status !== statusFilter) return false;
      if (q) {
        const c = clientById.get(inv.client_id);
        const hay = `${inv.id} ${c?.name || ''} ${inv.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data.invoices, clientFilter, statusFilter, search, clientById, pays, today]);

  const stats = useMemo(() => {
    const live = data.invoices.filter((i) => i.status !== 'void');
    const open = live.filter((i) => i.status !== 'draft');
    const overdue = live.filter((i) => isOverdue(i, today, pays));
    return {
      outstanding: sumCents(open.map((i) => balanceDue(i, pays))),
      collected: sumCents(live.map((i) => paidOf(i, pays))),
      overdue: sumCents(overdue.map((i) => balanceDue(i, pays))),
      overdueCount: overdue.length,
      drafts: live.filter((i) => i.status === 'draft').length,
    };
  }, [data.invoices, pays, today]);

  const run = async (fn, okMsg) => {
    try {
      await fn();
      await reload();
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast('Error: ' + e.message);
    }
  };
  const check = ({ error }) => { if (error) throw error; };

  const markSent = (inv) => run(async () => {
    check(await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', inv.id));
  }, 'Invoice marked as sent');

  /** "Mark Paid" = record the remaining balance as a payment; the trigger sets status=paid. */
  const markPaidInFull = (inv, method) => run(async () => {
    const bal = balanceDue(inv, pays);
    if (bal > 0) {
      check(await supabase.from('invoice_payments').insert({ invoice_id: inv.id, amount: bal, paid_at: today, method }));
    }
    const patch = { paid_via: method };
    if (bal <= 0) { patch.status = 'paid'; patch.paid_at = new Date().toISOString(); }
    check(await supabase.from('invoices').update(patch).eq('id', inv.id));
  }, 'Invoice marked as paid');

  const voidInvoice = (inv) => {
    if (paidOf(inv, pays) > 0) { toast('Delete the recorded payments before voiding this invoice'); return; }
    if (!confirm('Void this invoice? Its lessons will become billable again.')) return;
    run(async () => {
      check(await supabase.from('bookings').update({ invoice_id: null }).eq('invoice_id', inv.id));
      check(await supabase.from('invoices').update({ status: 'void' }).eq('id', inv.id));
    }, 'Invoice voided');
  };

  const deleteInvoice = (inv) => {
    if (!confirm('Delete this invoice? Its payments are deleted and its lessons become billable again.')) return;
    run(async () => {
      check(await supabase.from('bookings').update({ invoice_id: null }).eq('invoice_id', inv.id));
      check(await supabase.from('invoice_payments').delete().eq('invoice_id', inv.id));
      check(await supabase.from('invoices').delete().eq('id', inv.id));
    }, 'Invoice deleted');
  };

  const deletePayment = (p) => {
    if (!confirm(`Delete this ${formatMoney(p.amount)} payment?`)) return;
    run(async () => { check(await supabase.from('invoice_payments').delete().eq('id', p.id)); }, 'Payment deleted');
  };

  const sendEmail = async (inv) => {
    const c = clientById.get(inv.client_id);
    if (!c?.email) { toast('Client has no email address'); return; }
    setSending(inv.id);
    try {
      const { data: res, error } = await supabase.functions.invoke('send-invoice', { body: { invoice_id: inv.id } });
      let errBody = null;
      if (error) {
        try { errBody = error.context && typeof error.context.json === 'function' ? await error.context.json() : null; } catch { errBody = null; }
        if (!errBody) errBody = { error: error.message || 'Send failed' };
      }
      const r = interpretSendResult(res, errBody);
      if (r.notConfigured) {
        setMailtoFallback((m) => ({ ...m, [inv.id]: true }));
        toast('Email sending isn’t set up yet — use “Open in my email app” instead.');
        return;
      }
      if (!r.ok) { toast('Error: ' + r.message); return; }
      await reload();
      toast(`Invoice emailed to ${c.email}`);
    } catch (e) {
      toast('Error: ' + e.message);
    } finally {
      setSending(null);
    }
  };

  const mailtoSend = (inv) => {
    const c = clientById.get(inv.client_id);
    if (!c?.email) { toast('Client has no email address'); return; }
    window.open(mailtoHref(c.email, emailText({ invoice: inv, client: c, settings, profile, payments: pays })));
    if (inv.status === 'draft') markSent(inv);
  };

  const sendSms = (inv) => {
    const c = clientById.get(inv.client_id);
    if (!c?.phone) { toast('Client has no phone number'); return; }
    window.open(smsHref(c.phone, smsText({ invoice: inv, settings, profile, payments: pays })));
    if (inv.status === 'draft') markSent(inv);
  };

  const copyInvoice = (inv) => {
    const text = clipboardText({ invoice: inv, client: clientById.get(inv.client_id), settings, profile, payments: pays });
    navigator.clipboard.writeText(text).then(() => toast('Invoice copied to clipboard')).catch(() => toast('Could not copy to clipboard'));
  };

  const lineItems = (inv) => {
    const lessonById = new Map(data.lessons.map((x) => [x.id, x]));
    const studentById = new Map(data.students.map((s) => [s.id, s]));
    return data.bookings
      .filter((b) => b.invoice_id === inv.id && lessonById.has(b.lesson_id))
      .map((b) => {
        const lesson = lessonById.get(b.lesson_id);
        const type = lessonTypeFor(lesson.lesson_type, settings.custom_lesson_types);
        const late = b.status === 'cancelled';
        return {
          date: lesson.date,
          description: `${type.name} lesson — ${studentById.get(b.student_id)?.name || 'Student'}${late ? ' (late cancellation)' : ''}`,
          rate: lesson.rate || type.rate || 0,
        };
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  };

  const printInvoice = (inv) => {
    const html = printHtml({ invoice: inv, client: clientById.get(inv.client_id), settings, profile, items: lineItems(inv), payments: pays });
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print invoices'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const badgeFor = (inv) => {
    if (isOverdue(inv, today, pays)) return { ...l.badge, ...l.badgeDanger };
    if (inv.status === 'paid') return { ...l.badge, ...l.badgeSuccess };
    if (inv.status === 'partial') return { ...l.badge, ...l.badgeInfo };
    if (inv.status === 'void') return { ...l.badge, background: '#e2e8f0', color: '#475569' };
    return { ...l.badge, ...l.badgeWarning };
  };
  const btn = (extra) => ({ ...l.btn, ...l.btnSmall, ...extra, marginRight: 4, marginBottom: 4 });
  const markPaidSelect = {
    ...l.select, display: 'inline', width: 'auto', padding: '4px 8px', fontSize: 12, fontWeight: 500,
    background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginRight: 4, marginBottom: 4,
  };

  const actions = (inv) => {
    const open = inv.status !== 'paid' && inv.status !== 'void';
    const bal = balanceDue(inv, pays);
    return (
      <>
        {open && (
          <button style={btn(l.btnPrimary)} onClick={() => sendEmail(inv)} disabled={sending === inv.id} title="Email this invoice to the client">
            {sending === inv.id ? 'Sending…' : '📧 Email'}
          </button>
        )}
        {open && mailtoFallback[inv.id] && (
          <button style={btn(l.btnSecondary)} onClick={() => mailtoSend(inv)} title="Send via your own email app">✉️ Open in my email app</button>
        )}
        {open && (isMobile
          ? <button style={btn(l.btnSecondary)} onClick={() => sendSms(inv)} title="Send via text message">💬 Text</button>
          : <button style={btn(l.btnSecondary)} onClick={() => copyInvoice(inv)} title="Copy invoice to clipboard">📋 Copy</button>)}
        <button style={btn(l.btnSecondary)} onClick={() => printInvoice(inv)} title="Print invoice">🖨️ Print</button>
        {inv.status === 'draft' && <button style={btn(l.btnSecondary)} onClick={() => markSent(inv)}>Mark Sent</button>}
        {open && bal > 0 && <button style={btn(l.btnSuccess)} onClick={() => setPaying(inv)}>💵 Record Payment</button>}
        {open && (
          <select style={markPaidSelect} value="" onChange={(e) => e.target.value && markPaidInFull(inv, e.target.value)} title="Record the remaining balance as paid">
            <option value="">Mark Paid in Full ▾</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {open && <button style={btn(l.btnSecondary)} onClick={() => voidInvoice(inv)}>Void</button>}
        <button style={btn(l.btnDanger)} onClick={() => deleteInvoice(inv)}>Delete</button>
      </>
    );
  };

  const history = (inv) => {
    const mine = pays.filter((p) => p.invoice_id === inv.id);
    return (
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Payment history</div>
        {mine.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>No payments recorded.</div>
        ) : mine.map((p) => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13, flexWrap: 'wrap' }}>
            <span>{formatDate(p.paid_at)} · {p.method || '-'}{p.reference ? ` · #${p.reference}` : ''}{p.notes ? ` · ${p.notes}` : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong>{formatMoney(p.amount)}</strong>
              <button style={{ ...l.btn, ...l.btnSmall, ...l.btnDanger }} onClick={() => deletePayment(p)} aria-label="Delete payment">🗑️</button>
            </span>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 13 }}>
          Total {formatMoney(totalOf(inv))} · Paid {formatMoney(paidOf(inv, pays))} · <strong>Balance {formatMoney(balanceDue(inv, pays))}</strong>
          {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
        </div>
        {inv.notes && <div style={{ marginTop: 6, fontSize: 13, color: '#475569' }}>Notes: {inv.notes}</div>}
      </div>
    );
  };

  const statusLabel = (inv) => (isOverdue(inv, today, pays) ? `overdue (${inv.status})` : inv.status);
  const paymentCount = (inv) => pays.filter((p) => p.invoice_id === inv.id).length;

  return (
    <div>
      <div style={l.statsGrid}>
        <div style={l.statCard}><div style={l.statValue}>{formatMoney(stats.outstanding)}</div><div style={l.statLabel}>Outstanding</div></div>
        <div style={l.statCard}><div style={{ ...l.statValue, color: '#10b981' }}>{formatMoney(stats.collected)}</div><div style={l.statLabel}>Collected</div></div>
        <div style={l.statCard}><div style={{ ...l.statValue, color: '#ef4444' }}>{formatMoney(stats.overdue)}</div><div style={l.statLabel}>Overdue ({stats.overdueCount})</div></div>
        <div style={l.statCard}><div style={l.statValue}>{stats.drafts}</div><div style={l.statLabel}>Drafts</div></div>
      </div>

      <div style={l.card}>
        <div style={l.cardHeader}>
          <h2 style={l.cardTitle}>Invoices</h2>
          <button style={{ ...l.btn, ...l.btnPrimary }} onClick={() => setCreateFor(clientFilter || '')}>+ Create Invoice</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <select style={l.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status filter">
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select style={l.select} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} aria-label="Client filter">
            <option value="">All clients</option>
            {data.clients.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <input style={l.input} placeholder="Search invoice #, client, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {data.invoices.length === 0 ? (
          <div style={l.empty}>No invoices yet. Create one from the Clients tab!</div>
        ) : filtered.length === 0 ? (
          <div style={l.empty}>No invoices match these filters.</div>
        ) : isMobile ? (
          <div>
            {filtered.map((inv) => (
              <div key={inv.id} style={{ borderBottom: '1px solid #e2e8f0', padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <strong>#{inv.id} · {clientById.get(inv.client_id)?.name || '-'}</strong>
                  <span style={badgeFor(inv)}>{statusLabel(inv)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
                  {formatDate(inv.created_at)} · Total {formatMoney(totalOf(inv))} · Paid {formatMoney(paidOf(inv, pays))} · <strong>Bal {formatMoney(balanceDue(inv, pays))}</strong>
                </div>
                <div>{actions(inv)}
                  <button style={btn(l.btnSecondary)} onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}>
                    {expanded === inv.id ? '▲ Hide' : `▼ Payments (${paymentCount(inv)})`}
                  </button>
                </div>
                {expanded === inv.id && <div style={{ marginTop: 8 }}>{history(inv)}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={l.table}>
              <thead>
                <tr>
                  <th style={l.th}>#</th><th style={l.th}>Date</th><th style={l.th}>Client</th><th style={l.th}>Total</th>
                  <th style={l.th}>Paid</th><th style={l.th}>Balance</th><th style={l.th}>Due</th><th style={l.th}>Status</th><th style={l.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <FragmentRows key={inv.id}>
                    <tr>
                      <td style={l.td}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', fontWeight: 600, padding: 0 }}
                          onClick={() => setExpanded(expanded === inv.id ? null : inv.id)} title="Show payment history">
                          {expanded === inv.id ? '▲' : '▼'} {inv.id}
                        </button>
                      </td>
                      <td style={l.td}>{formatDate(inv.created_at)}</td>
                      <td style={l.td}>{clientById.get(inv.client_id)?.name || '-'}</td>
                      <td style={l.td}>{formatMoney(totalOf(inv))}</td>
                      <td style={l.td}>{formatMoney(paidOf(inv, pays))}</td>
                      <td style={{ ...l.td, fontWeight: 600 }}>{formatMoney(balanceDue(inv, pays))}</td>
                      <td style={l.td}>{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                      <td style={l.td}><span style={badgeFor(inv)}>{statusLabel(inv)}</span></td>
                      <td style={l.td}>{actions(inv)}</td>
                    </tr>
                    {expanded === inv.id && (
                      <tr><td style={l.td} colSpan={9}>{history(inv)}</td></tr>
                    )}
                  </FragmentRows>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createFor !== null && <InvoiceModal clientId={createFor} onClose={() => setCreateFor(null)} />}
      {paying && <PaymentModal invoice={paying} client={clientById.get(paying.client_id)} onClose={() => setPaying(null)} />}
    </div>
  );
}

function FragmentRows({ children }) {
  return <>{children}</>;
}
