const fs = require('fs');
const path = require('path');
const { isAuthed, noStoreHeaders } = require('./_lib/auth');

// Hardcoded on purpose: add a new doc set by dropping a folder + manifest.json
// under api/_private-docs/ and adding its slug here.
const SETS = ['nearnosh'];

module.exports = async function handler(req, res) {
  noStoreHeaders(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }

  if (!isAuthed(req)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const sets = [];
  for (const slug of SETS) {
    try {
      const raw = fs.readFileSync(
        path.join(process.cwd(), 'api', '_private-docs', slug, 'manifest.json'),
        'utf8'
      );
      sets.push(JSON.parse(raw));
    } catch (e) {
      // Set not present on disk yet (e.g. docs not copied in) — skip it.
    }
  }

  return res.status(200).json({ sets });
};
