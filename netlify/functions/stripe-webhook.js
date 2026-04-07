// Receives Stripe webhook events and fulfills orders automatically.
// Fires when a card payment succeeds → saves to Airtable, emails owner + customer.
//
// Required env vars:
//   STRIPE_SECRET_KEY       — sk_live_...
//   STRIPE_WEBHOOK_SECRET   — whsec_... (from Stripe Dashboard → Webhooks → signing secret)
//   AIRTABLE_API_KEY        — your Airtable Personal Access Token
//   AIRTABLE_BASE_ID        — app... (from your Airtable base URL)
//   RESEND_API_KEY          — re_... (from resend.com)
//   OWNER_EMAIL             — your email address for order notifications
//   FROM_EMAIL              — orders@aethera2.com (must be verified in Resend)

const crypto = require('crypto');

// ─── Stripe signature verification (no npm package needed) ───────────────────

function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret) return true; // skip if not configured
  const parts = {};
  sigHeader.split(',').forEach(chunk => {
    const eq = chunk.indexOf('=');
    const key = chunk.slice(0, eq);
    const val = chunk.slice(eq + 1);
    if (key === 't') parts.t = val;
    if (key === 'v1') (parts.v1 = parts.v1 || []).push(val);
  });
  if (!parts.t || !parts.v1?.length) return false;
  const signedPayload = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret)
    .update(signedPayload, 'utf8').digest('hex');
  return parts.v1.some(sig => {
    try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); }
    catch { return false; }
  });
}

// ─── Save order to Airtable ───────────────────────────────────────────────────

async function saveOrder(fields) {
  const res = await fetch(
    `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ records: [{ fields }] }),
    }
  );
  const data = await res.json();
  if (!res.ok) console.error('Airtable error:', JSON.stringify(data));
  return data;
}

// ─── Send email via Resend ────────────────────────────────────────────────────

async function sendEmail({ to, subject, html }) {
  const from = process.env.FROM_EMAIL || 'orders@aethera2.com';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: `ÆTHER <${from}>`, to, subject, html }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

// ─── Email templates ──────────────────────────────────────────────────────────

function ownerEmailHTML(o, status) {
  const statusBg = status === 'Paid' ? '#1a4a1a' : '#4a4a1a';
  const addr = [o.address, o.apt, o.city && `${o.city}, ${o.state} ${o.zip}`]
    .filter(Boolean).join('<br/>');
  return `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:32px;max-width:560px;">
<h2 style="color:#9A7D2E;letter-spacing:.15em;margin:0 0 4px;">ÆTHER</h2>
<p style="color:#888880;font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 24px;">New Order</p>
<div style="background:#111108;border:1px solid #2a2a22;padding:20px;margin-bottom:20px;">
  <span style="display:inline-block;background:${statusBg};border:1px solid #3a5a3a;color:#aaaaaa;font-size:10px;letter-spacing:.3em;text-transform:uppercase;padding:3px 10px;margin-bottom:12px;">${status}</span>
  <p style="color:#888880;font-size:10px;letter-spacing:.25em;text-transform:uppercase;margin:0 0 4px;">Order Reference</p>
  <p style="font-size:16px;margin:0;color:#fff;">${o.ref}</p>
</div>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;width:120px;">Customer</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${o.name}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Email</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${o.email || '—'}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Phone</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${o.phone || '—'}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Item</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${o.productName} &times; ${o.qty}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Shipping</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${o.shippingMethod}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Ship To</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${addr}</td></tr>
  <tr><td style="padding:12px 0 0;color:#666660;">Total</td>
      <td style="padding:12px 0 0;color:#9A7D2E;font-size:20px;">$${(o.totalCents / 100).toFixed(2)}</td></tr>
</table>
<p style="color:#444440;font-size:10px;letter-spacing:.1em;margin-top:28px;border-top:1px solid #1a1a14;padding-top:16px;">
  Manage this order in Airtable · Payment via ${o.paymentMethod}${o.stripeId ? ` · Stripe: ${o.stripeId}` : ''}
</p>
</body></html>`;
}

function customerEmailHTML(o) {
  const addr = [o.address, o.apt, o.city && `${o.city}, ${o.state} ${o.zip}`]
    .filter(Boolean).join(', ');
  return `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:32px;max-width:560px;">
<h2 style="color:#9A7D2E;letter-spacing:.15em;margin:0 0 4px;">ÆTHER</h2>
<p style="color:#888880;font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 24px;">Order Confirmed</p>
<p style="font-size:14px;line-height:1.8;color:#aaaaaa;">Thank you for your order. We'll ship your items discreetly within 1–2 business days and send a follow-up when it's on the way.</p>
<div style="background:#111108;border:1px solid #2a2a22;padding:20px;margin:20px 0;">
  <p style="color:#888880;font-size:10px;letter-spacing:.25em;text-transform:uppercase;margin:0 0 4px;">Order Reference</p>
  <p style="font-size:16px;margin:0;">${o.ref}</p>
</div>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:8px 0;border-bottom:1px solid #1a1a14;color:#666660;width:110px;">Item</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1a14;">${o.productName} &times; ${o.qty}</td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #1a1a14;color:#666660;">Shipping to</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1a14;">${addr}</td></tr>
  <tr><td style="padding:8px 0;border-bottom:1px solid #1a1a14;color:#666660;">Method</td>
      <td style="padding:8px 0;border-bottom:1px solid #1a1a14;">${o.shippingMethod}</td></tr>
  <tr><td style="padding:10px 0 0;color:#666660;">Total Paid</td>
      <td style="padding:10px 0 0;color:#9A7D2E;font-size:18px;">$${(o.totalCents / 100).toFixed(2)}</td></tr>
</table>
<p style="color:#444440;font-size:11px;margin-top:28px;border-top:1px solid #1a1a14;padding-top:16px;">
  Questions? Reply to this email or reach us on Signal at aethera2.com.
</p>
</body></html>`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  const sigHeader     = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
    return { statusCode: 400, body: 'Invalid Stripe signature' };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  if (stripeEvent.type === 'payment_intent.succeeded') {
    const pi   = stripeEvent.data.object;
    const meta = pi.metadata || {};

    const shippingLabels = {
      'usps':          'USPS First Class (3–5 days)',
      'usps-priority': 'USPS Priority Mail (1–3 days)',
      'ups':           'UPS Ground (2–5 days)',
    };

    const order = {
      ref:            meta.order_ref     || pi.id,
      name:           meta.customer_name || 'Unknown',
      email:          meta.customer_email || '',
      phone:          meta.customer_phone || '',
      address:        meta.address_line1  || '',
      apt:            meta.address_line2  || '',
      city:           meta.address_city   || '',
      state:          meta.address_state  || '',
      zip:            meta.address_zip    || '',
      productName:    meta.product_name   || '',
      productSku:     meta.product_sku    || '',
      qty:            parseInt(meta.product_qty) || 1,
      shippingMethod: shippingLabels[meta.shipping_method] || meta.shipping_method || '',
      subtotalCents:  parseInt(meta.subtotal_cents) || 0,
      shippingCents:  parseInt(meta.shipping_cents) || 0,
      totalCents:     pi.amount,
      paymentMethod:  'Card',
      stripeId:       pi.id,
    };

    // ── Save to Airtable ──
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      await saveOrder({
        'Order Ref':       order.ref,
        'Status':          'Paid — Ready to Ship',
        'Payment Method':  order.paymentMethod,
        'Customer Name':   order.name,
        'Email':           order.email,
        'Phone':           order.phone,
        'Address':         [order.address, order.apt].filter(Boolean).join(', '),
        'City':            order.city,
        'State':           order.state,
        'ZIP':             order.zip,
        'Product':         order.productName,
        'SKU':             order.productSku,
        'Quantity':        order.qty,
        'Shipping Method': order.shippingMethod,
        'Subtotal':        order.subtotalCents / 100,
        'Shipping Cost':   order.shippingCents / 100,
        'Total':           order.totalCents / 100,
        'Stripe PI':       order.stripeId,
      }).catch(e => console.error('Airtable save failed:', e));
    }

    // ── Email owner ──
    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail && process.env.RESEND_API_KEY) {
      await sendEmail({
        to:      [ownerEmail],
        subject: `New Order — ${order.ref} — $${(order.totalCents / 100).toFixed(2)} PAID`,
        html:    ownerEmailHTML(order, 'Paid'),
      }).catch(e => console.error('Owner email failed:', e));
    }

    // ── Email customer ──
    if (order.email && process.env.RESEND_API_KEY) {
      await sendEmail({
        to:      [order.email],
        subject: `Your Order — ${order.ref} — ÆTHER`,
        html:    customerEmailHTML(order),
      }).catch(e => console.error('Customer email failed:', e));
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ received: true }),
  };
};
