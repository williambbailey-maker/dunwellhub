const fs = require('fs');
const path = require('path');
const { isAuthed, noStoreHeaders } = require('./_lib/auth');

const SET_RE = /^[a-z0-9-]+$/;
const FILE_RE = /^[A-Za-z0-9._-]+$/;
const CONTENT_TYPES = { '.pdf': 'application/pdf', '.zip': 'application/zip' };

module.exports = async function handler(req, res) {
  noStoreHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const query = req.query || {};
  const set = typeof query.set === 'string' ? query.set : '';
  const file = typeof query.file === 'string' ? query.file : '';
  const download = query.download === '1';

  if (!SET_RE.test(set) || !FILE_RE.test(file)) {
    return res.status(400).json({ error: 'invalid request' });
  }

  const ext = path.extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return res.status(400).json({ error: 'invalid request' });
  }

  const baseDir = path.join(process.cwd(), 'api', '_private-docs', set);
  const resolved = path.join(baseDir, file);

  // Defense in depth: even though the regexes above already reject '/' and
  // '..' segments, double-check the resolved path can't have escaped baseDir.
  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
    return res.status(400).json({ error: 'invalid request' });
  }

  // Only ever serve files that are actually listed in that set's manifest —
  // an allowlist, not just "whatever happens to be on disk".
  let allowed = false;
  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'manifest.json'), 'utf8')
    );
    const all = [
      ...(manifest.featured || []),
      ...((manifest.groups || []).flatMap((g) => g.docs || [])),
    ];
    allowed = all.some((d) => d.file === file);
  } catch (e) {
    allowed = false;
  }
  if (!allowed) {
    return res.status(404).json({ error: 'not found' });
  }

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (e) {
    return res.status(404).json({ error: 'not found' });
  }
  if (!stat.isFile()) {
    return res.status(404).json({ error: 'not found' });
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stat.size);
  res.setHeader(
    'Content-Disposition',
    `${download ? 'attachment' : 'inline'}; filename="${file.replace(/"/g, '')}"`
  );
  res.status(200);
  fs.createReadStream(resolved).pipe(res);
};
