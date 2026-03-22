// Simple in-memory rate limiter — resets when function cold-starts (good enough for beta)
const LIMIT = 10; // max generations per IP per day
const usage = {}; // { ip: { count, date } }

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Rate limit check
  const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (!usage[ip] || usage[ip].date !== today) {
    usage[ip] = { count: 0, date: today };
  }

  if (usage[ip].count >= LIMIT) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: `Free limit reached (${LIMIT} generations/day). Come back tomorrow or contact us to upgrade.` })
    };
  }

  usage[ip].count++;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured on server.' }) };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: event.body,
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data.error?.message || 'Anthropic API error' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
