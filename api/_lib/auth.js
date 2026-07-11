const crypto = require('crypto');

const COOKIE_NAME = 'dw_vault';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function safeCompare(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sign(expiry) {
  return crypto
    .createHmac('sha256', process.env.VAULT_SESSION_SECRET || '')
    .update(String(expiry))
    .digest('hex');
}

function makeSessionCookie() {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const value = `${expiry}.${sign(expiry)}`;
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthed(req) {
  const cookies =
    req.cookies && typeof req.cookies === 'object'
      ? req.cookies
      : parseCookies(req.headers && req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return false;

  const idx = raw.indexOf('.');
  if (idx === -1) return false;
  const expiry = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  if (!/^\d+$/.test(expiry)) return false;

  const expected = sign(expiry);
  let sigBuf, expBuf;
  try {
    sigBuf = Buffer.from(sig, 'hex');
    expBuf = Buffer.from(expected, 'hex');
  } catch (e) {
    return false;
  }
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  return Number(expiry) > Date.now();
}

function noStoreHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}

module.exports = {
  COOKIE_NAME,
  safeCompare,
  makeSessionCookie,
  clearSessionCookie,
  isAuthed,
  noStoreHeaders,
};
