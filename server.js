// Local / any-Node-host server. On Vercel this file is not used: Vercel serves /public
// and runs /api/*.js itself (see vercel.json). Same handlers either way.
//
//   npm start            -> http://localhost:3000
//   PORT=8080 npm start

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PUBLIC = join(ROOT, 'public');

// Minimal .env loader (no dependency)
const envFile = join(ROOT, '.env');
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

const ROUTES = [
  [/^\/$/, 'index'],
  [/^\/work\/[^/]+\/?$/, 'work'],
  [/^\/sitemap\.xml$/, 'sitemap'],
  [/^\/robots\.txt$/, 'robots'],
  [/^\/api\/(book|config)\/?$/, (m) => m[1]],
];

async function runApi(name, req, res) {
  const mod = await import(pathToFileURL(join(ROOT, 'api', `${name}.js`)).href);
  await mod.default(req, res);
}

async function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/admin' || rel === '/admin/') rel = '/admin/index.html';
  const file = normalize(join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return false;
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    const body = await readFile(file);
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    if (rel.startsWith('/admin')) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://local');
    for (const [pattern, target] of ROUTES) {
      const m = pathname.match(pattern);
      if (m) return await runApi(typeof target === 'function' ? target(m) : target, req, res);
    }
    if (await serveStatic(pathname, res)) return;
    // Anything else: the branded 404 page
    req.url = '/work/__not-found__';
    return await runApi('work', req, res);
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Server error');
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}  (admin: /admin)`));
