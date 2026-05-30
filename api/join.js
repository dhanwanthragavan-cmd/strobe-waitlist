const BASE_COUNT = 847;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let email;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = (body?.email || '').trim().toLowerCase();
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    // No database configured — return optimistic success so the form still works
    return res.status(200).json({ ok: true, count: BASE_COUNT + 1 });
  }

  try {
    // Pipeline: SADD the email, then SCARD to get total unique count
    const pipeRes = await fetch(`${REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['SADD', 'strobe:emails', email],
        ['SCARD', 'strobe:emails'],
      ]),
      cache: 'no-store',
    });

    const results = await pipeRes.json();
    const dbCount = typeof results?.[1]?.result === 'number' ? results[1].result : 0;
    const wasNew = results?.[0]?.result === 1;

    return res.status(200).json({
      ok: true,
      count: BASE_COUNT + dbCount,
      new: wasNew,
    });
  } catch (err) {
    console.error('Redis error:', err);
    return res.status(500).json({ error: 'Database unavailable, try again shortly' });
  }
}
