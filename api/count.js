const BASE_COUNT = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!REDIS_URL || !REDIS_TOKEN) {
    return res.status(200).json({ count: BASE_COUNT });
  }

  try {
    const r = await fetch(`${REDIS_URL}/scard/strobe:emails`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: 'no-store',
    });
    const json = await r.json();
    const dbCount = typeof json.result === 'number' ? json.result : 0;
    return res.status(200).json({ count: BASE_COUNT + dbCount });
  } catch {
    return res.status(200).json({ count: BASE_COUNT });
  }
}
