// Netlify serverless function — creates a Stripe PaymentIntent
//
// Required env var in Netlify dashboard (Site settings → Environment variables):
//   STRIPE_SECRET_KEY = sk_live_... (your Stripe secret key)
//
// This file never exposes your secret key to the browser.

exports.handler = async function (event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured in Netlify environment variables.' })
    };
  }

  let amount, currency;
  try {
    ({ amount, currency } = JSON.parse(event.body));
    if (!amount || amount < 50) throw new Error('Invalid amount');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  // Call Stripe API directly — no npm package needed
  const params = new URLSearchParams({
    amount:    String(Math.round(amount)),
    currency:  currency || 'usd',
    'automatic_payment_methods[enabled]': 'true',
  });

  const response = await fetch('https://api.stripe.com/v1/payment_intents', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const paymentIntent = await response.json();

  if (paymentIntent.error) {
    console.error('Stripe error:', paymentIntent.error);
    return { statusCode: 400, body: JSON.stringify({ error: paymentIntent.error.message }) };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
  };
};
