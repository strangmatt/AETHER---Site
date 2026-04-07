// Creates a Stripe PaymentIntent and attaches full order metadata.
// Metadata is read by stripe-webhook.js when payment succeeds.
//
// Required env vars (Netlify → Site settings → Environment variables):
//   STRIPE_SECRET_KEY  — sk_live_... from Stripe Dashboard

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not set.' }) };
  }

  let amount, currency, metadata;
  try {
    ({ amount, currency, metadata } = JSON.parse(event.body));
    if (!amount || amount < 50) throw new Error('Invalid amount');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  // Build Stripe API params — metadata values must be strings
  const params = new URLSearchParams({
    amount:    String(Math.round(amount)),
    currency:  currency || 'usd',
    'automatic_payment_methods[enabled]': 'true',
  });

  if (metadata && typeof metadata === 'object') {
    Object.entries(metadata).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params.append(`metadata[${k}]`, String(v));
      }
    });
  }

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const pi = await response.json();

  if (pi.error) {
    console.error('Stripe error:', pi.error);
    return { statusCode: 400, body: JSON.stringify({ error: pi.error.message }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientSecret: pi.client_secret }),
  };
};
