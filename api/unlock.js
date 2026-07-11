const {
  safeCompare,
  makeSessionCookie,
  clearSessionCookie,
  noStoreHeaders,
} = require('./_lib/auth');

const ARTIFICIAL_DELAY_MS = 500;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = async function handler(req, res) {
  noStoreHeaders(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body || '{}');
    } catch (e) {
      body = {};
    }
  }
  body = body && typeof body === 'object' ? body : {};

  if (body.logout) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ ok: true });
  }

  // Constant delay on every attempt so response timing can't be used to
  // distinguish a wrong password from a slow one, and so brute-forcing is
  // at least mildly expensive.
  await delay(ARTIFICIAL_DELAY_MS);

  const expected = process.env.VAULT_PASSWORD;
  const supplied = typeof body.password === 'string' ? body.password : '';

  if (!expected || !supplied || !safeCompare(supplied, expected)) {
    return res.status(401).json({ error: 'incorrect password' });
  }

  res.setHeader('Set-Cookie', makeSessionCookie());
  return res.status(200).json({ ok: true });
};
