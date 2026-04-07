// Saves Zelle and Crypto orders immediately on checkout submit.
// These orders are marked "Pending Payment" until you verify and mark Shipped.
//
// Required env vars (same as stripe-webhook.js):
//   AIRTABLE_API_KEY   AIRTABLE_BASE_ID
//   RESEND_API_KEY     OWNER_EMAIL     FROM_EMAIL

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let order;
  try { order = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const shippingLabels = {
    'usps':          'USPS First Class (3–5 days)',
    'usps-priority': 'USPS Priority Mail (1–3 days)',
    'ups':           'UPS Ground (2–5 days)',
  };
  order.shippingLabel = shippingLabels[order.shippingMethod] || order.shippingMethod || '';

  // ─── Save to Airtable ────────────────────────────────────────────────────────
  if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
    const fields = {
      'Order Ref':       order.ref,
      'Status':          'Pending Payment',
      'Payment Method':  order.paymentMethod === 'zelle' ? 'Zelle' : 'Crypto',
      'Customer Name':   order.name,
      'Email':           order.email || '',
      'Phone':           order.phone || '',
      'Address':         [order.address, order.apt].filter(Boolean).join(', '),
      'City':            order.city,
      'State':           order.state,
      'ZIP':             order.zip,
      'Product':         order.productName,
      'SKU':             order.productSku,
      'Quantity':        order.qty,
      'Shipping Method': order.shippingLabel,
      'Subtotal':        order.subtotalCents / 100,
      'Shipping Cost':   order.shippingCents / 100,
      'Total':           order.totalCents / 100,
    };

    const atRes = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Orders`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${process.env.AIRTABLE_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ records: [{ fields }] }),
      }
    );
    if (!atRes.ok) console.error('Airtable error:', await atRes.text());
  }

  // ─── Email owner ─────────────────────────────────────────────────────────────
  const ownerEmail = process.env.OWNER_EMAIL;
  if (ownerEmail && process.env.RESEND_API_KEY) {
    const from    = process.env.FROM_EMAIL || 'orders@aethera2.com';
    const addr    = [order.address, order.apt, order.city && `${order.city}, ${order.state} ${order.zip}`]
                    .filter(Boolean).join('<br/>');
    const method  = order.paymentMethod === 'zelle' ? 'Zelle' : 'Crypto';
    const total   = `$${(order.totalCents / 100).toFixed(2)}`;
    const subject = `New Order — ${order.ref} — ${total} PENDING (${method})`;
    const html = `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;padding:32px;max-width:560px;">
<h2 style="color:#9A7D2E;letter-spacing:.15em;margin:0 0 4px;">ÆTHER</h2>
<p style="color:#888880;font-size:11px;letter-spacing:.3em;text-transform:uppercase;margin:0 0 24px;">New Order — Pending Payment</p>
<div style="background:#111108;border:1px solid #4a4a1a;padding:20px;margin-bottom:20px;">
  <span style="display:inline-block;background:#4a4a1a;border:1px solid #6a6a2a;color:#aaa;font-size:10px;letter-spacing:.3em;text-transform:uppercase;padding:3px 10px;margin-bottom:12px;">PENDING — ${method}</span>
  <p style="color:#888880;font-size:10px;letter-spacing:.25em;text-transform:uppercase;margin:0 0 4px;">Order Reference</p>
  <p style="font-size:16px;margin:0;">${order.ref}</p>
</div>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;width:120px;">Customer</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${order.name}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Email</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${order.email || '—'}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Phone</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${order.phone || '—'}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Item</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${order.productName} &times; ${order.qty}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Shipping</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${order.shippingLabel}</td></tr>
  <tr><td style="padding:9px 0;border-bottom:1px solid #1a1a14;color:#666660;">Ship To</td>
      <td style="padding:9px 0;border-bottom:1px solid #1a1a14;">${addr}</td></tr>
  <tr><td style="padding:12px 0 0;color:#666660;">Total</td>
      <td style="padding:12px 0 0;color:#9A7D2E;font-size:20px;">${total}</td></tr>
</table>
<p style="color:#9a6a2e;font-size:12px;margin-top:20px;padding:12px;border:1px solid #4a4a1a;background:#0d0d08;">
  Verify ${method} payment before shipping. Once confirmed, update status in Airtable to "Paid — Ready to Ship".
</p>
</body></html>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: `ÆTHER <${from}>`, to: [ownerEmail], subject, html }),
    });
    if (!emailRes.ok) console.error('Resend error:', await emailRes.text());
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};
