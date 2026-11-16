// send-invoice: POST { invoice_id } with the coach's JWT.
// Loads invoice + client + settings with the CALLER's JWT (RLS applies: only the owning coach can read them),
// emails the client through the Resend REST API and marks the invoice sent.
// Env: RESEND_API_KEY (required); RESEND_FROM_ADDRESS (optional, default invoices@mail.sk8happy.com).
// From = "<settings.coach_name> <address>", Reply-To = settings.coach_email. SUPABASE_URL / SUPABASE_ANON_KEY
// are injected by the Supabase runtime.
// Errors are JSON { error: <code>, message? }:
//   unauthorized | bad_request | not_found | invoice_void | client_has_no_email | email_not_configured | email_failed
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { buildFromHeader, formatCents, pickReplyTo, stripHeaderUnsafe, toCents } from './sender.ts';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function fmtDate(d: string | null): string {
  if (!d) return 'Upon receipt';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', {
    timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// deno-lint-ignore no-explicit-any
function paymentMethods(inv: any): string[] {
  const out: string[] = [];
  if (inv.payment_cash) out.push('Cash');
  if (inv.payment_check) out.push('Check');
  if (inv.payment_venmo) out.push(`Venmo: ${inv.payment_venmo}`);
  if (inv.payment_paypal) out.push(`PayPal: ${inv.payment_paypal}`);
  if (inv.payment_zelle) out.push(`Zelle: ${inv.payment_zelle}`);
  if (inv.payment_cashapp) out.push(`Cash App: ${inv.payment_cashapp}`);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'bad_request', message: 'POST only' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Verify the JWT (gateway verify_jwt also checks the signature; this resolves the user).
  const { data: userData, error: userErr } = await supabase.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);
  const user = userData.user;

  let invoiceId: number;
  try {
    const body = await req.json();
    invoiceId = Number(body?.invoice_id);
  } catch {
    return json({ error: 'bad_request', message: 'Body must be JSON { invoice_id }' }, 400);
  }
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return json({ error: 'bad_request', message: 'invoice_id is required' }, 400);
  }

  // RLS: returns a row only when the caller is the coach who owns the invoice.
  const { data: inv, error: invErr } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
  if (invErr) return json({ error: 'bad_request', message: invErr.message }, 400);
  if (!inv) return json({ error: 'not_found', message: 'Invoice not found' }, 404);
  if (inv.status === 'void') return json({ error: 'invoice_void', message: 'This invoice is void' }, 409);

  const [{ data: client }, { data: settings }, { data: profile }] = await Promise.all([
    supabase.from('clients').select('name,email,parent2_email').eq('id', inv.client_id).maybeSingle(),
    supabase.from('settings').select('*').eq('coach_id', inv.coach_id).maybeSingle(),
    supabase.from('profiles').select('name,email').eq('id', user.id).maybeSingle(),
  ]);
  if (!client) return json({ error: 'not_found', message: 'Client not found' }, 404);
  if (!client.email) return json({ error: 'client_has_no_email', message: 'Client has no email address' }, 422);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    return json({ error: 'email_not_configured', message: 'Set RESEND_API_KEY for the send-invoice function' }, 503);
  }

  const coachName = settings?.coach_name || profile?.name || 'Your Coach';
  const from = buildFromHeader(settings?.coach_name || profile?.name, Deno.env.get('RESEND_FROM_ADDRESS'));
  const replyTo = pickReplyTo(settings?.coach_email, profile?.email, user.email);
  // Money in integer cents (no float drift).
  const totalC = toCents(inv.total || inv.amount || 0);
  const paidC = toCents(inv.amount_paid || 0);
  const balanceC = Math.max(totalC - paidC, 0);
  const total = formatCents(totalC), paid = formatCents(paidC), balance = formatCents(balanceC);
  const methods = paymentMethods(inv);
  const policy = (settings?.cancellation_policy || '').trim();
  const dueText = fmtDate(inv.due_date);
  const subject = stripHeaderUnsafe(`Invoice #${inv.id} from ${coachName} - ${balance} due`);

  const text = [
    `Hi ${client.name},`,
    '',
    'Please find your invoice details below:',
    '',
    `Invoice #: ${inv.id}`,
    `Invoice Total: ${total}`,
    paidC > 0 ? `Paid to Date: ${paid}` : '',
    `Balance Due: ${balance}`,
    `Due Date: ${dueText}`,
    inv.notes ? `Notes: ${inv.notes}` : '',
    '',
    methods.length ? `Payment Methods:\n${methods.join('\n')}` : '',
    '',
    policy ? `Cancellation Policy:\n${policy}` : '',
    '',
    'Thank you!',
    coachName,
    settings?.coach_email || '',
    settings?.coach_phone || '',
  ].filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '')).join('\n');

  const row = (k: string, v: string, strong = false) =>
    `<tr><td style="padding:6px 0;color:#555">${esc(k)}</td><td style="padding:6px 0;text-align:right;${strong ? 'font-weight:700;font-size:18px' : ''}">${esc(v)}</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;padding:28px;border:1px solid #e5e7eb">
<h2 style="margin:0 0 4px">Invoice #${esc(inv.id)}</h2>
<div style="color:#6b7280;margin-bottom:20px">from ${esc(coachName)}</div>
<p>Hi ${esc(client.name)},</p><p>Please find your invoice details below:</p>
<table style="width:100%;border-collapse:collapse;margin:12px 0 20px">
${row('Invoice Total', total)}
${paidC > 0 ? row('Paid to Date', paid) : ''}
${row('Balance Due', balance, true)}
${row('Due Date', dueText)}
</table>
${inv.notes ? `<p><strong>Notes:</strong> ${esc(inv.notes)}</p>` : ''}
${methods.length ? `<h3 style="margin:20px 0 6px;font-size:15px">Payment Methods</h3><ul style="margin:0;padding-left:20px">${methods.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
${policy ? `<h3 style="margin:20px 0 6px;font-size:15px">Cancellation Policy</h3><p style="white-space:pre-wrap;margin:0">${esc(policy)}</p>` : ''}
<p style="margin-top:24px">Thank you!<br>${esc(coachName)}${settings?.coach_email ? `<br>${esc(settings.coach_email)}` : ''}${settings?.coach_phone ? `<br>${esc(settings.coach_phone)}` : ''}</p>
</div></body></html>`;

  const to = [client.email];
  const cc = client.parent2_email && client.parent2_email.toLowerCase() !== client.email.toLowerCase()
    ? [client.parent2_email] : undefined;

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, cc, reply_to: replyTo, subject, html, text }),
  });
  const resBody = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return json({ error: 'email_failed', message: resBody?.message || `Resend HTTP ${resp.status}` }, 502);
  }

  // Mark sent (keeps partial/paid status; the DB trigger derives those from payments).
  const patch: Record<string, unknown> = { sent_at: new Date().toISOString() };
  if (inv.status === 'draft') patch.status = 'sent';
  const { data: updated, error: upErr } = await supabase.from('invoices').update(patch).eq('id', inv.id).select().maybeSingle();
  if (upErr) {
    return json({ ok: true, email_id: resBody?.id ?? null, warning: `Email sent but invoice not updated: ${upErr.message}` });
  }
  return json({ ok: true, email_id: resBody?.id ?? null, to, invoice: updated });
});
