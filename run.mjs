// Automated checks for the server side: public pages, the "Book a call" API and access rules.
// No dependencies: uses Node's built-in test runner.   Run:  npm test
//
// It starts a fake Supabase (test/mock-supabase.js) and the real server.js, then talks to them over HTTP.
// Browser checks of the dashboard live in test/e2e.py (needs Python + Playwright).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMock, ADMIN, STRANGER, KEYS } from './mock-supabase.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const freePort = () => new Promise((resolve) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); }); });

async function startSite(env) {
  const port = await freePort();
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  child.stdout.on('data', (d) => { logs += d; });
  child.stderr.on('data', (d) => { logs += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/config`)).ok) return { base, child, logs: () => logs }; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`server did not start:\n${logs}`);
}

const json = (res) => res.json();
const post = (url, body, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

let mock, mockUrl;
let bare, wired; // servers: no Supabase vs. wired to the fake Supabase

before(async () => {
  mock = createMock();
  mockUrl = `http://127.0.0.1:${await mock.listen(0)}`;
  bare = await startSite({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' });
  wired = await startSite({ SUPABASE_URL: mockUrl, SUPABASE_ANON_KEY: KEYS.anon, SUPABASE_SERVICE_ROLE_KEY: KEYS.service, SITE_URL: 'https://wolfedit.example' });
});

after(async () => {
  bare?.child.kill();
  wired?.child.kill();
  await mock?.close();
});

async function adminToken() {
  const res = await post(`${mockUrl}/auth/v1/token?grant_type=password`, ADMIN, { apikey: KEYS.anon });
  return (await res.json()).access_token;
}
const asAdmin = async (path, init = {}) => {
  const t = await adminToken();
  return fetch(`${mockUrl}${path}`, { ...init, headers: { apikey: KEYS.anon, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
};

// ------------------------------------------------------------------ public site, no database yet
test('without Supabase the site still renders (Wolf Edit, logo, noindex)', async () => {
  const res = await fetch(`${bare.base}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /WOLF EDIT/);
  assert.match(html, /\/assets\/wolf-edit-logo\.webp/);
  assert.match(html, /name="robots" content="noindex/);
  assert.match(html, /Your vision\. My edit\. One powerful story\./);
  assert.match(res.headers.get('cache-control'), /s-maxage/);
  assert.doesNotMatch(html, /DEWANK SAINI/, 'the old brand name must be gone');
});

test('the logo, favicon and share image are served', async () => {
  for (const [path, type] of [['/assets/wolf-edit-logo.webp', 'image/webp'], ['/assets/wolf-edit-share.png', 'image/png'], ['/favicon.png', 'image/png'], ['/apple-touch-icon.png', 'image/png']]) {
    const res = await fetch(`${bare.base}${path}`);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get('content-type'), type, path);
    assert.ok((await res.arrayBuffer()).byteLength > 1000, `${path} looks empty`);
  }
  const html = await (await fetch(`${bare.base}/`)).text();
  assert.match(html, /property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/assets\/wolf-edit-share\.png"/, 'share image must be an absolute link');
});

test('there is no pricing anywhere: no section, no menu link, no plan button, no price field', async () => {
  const html = await (await fetch(`${bare.base}/`)).text();
  assert.doesNotMatch(html, /id="pricing"/);
  assert.doesNotMatch(html, />Pricing</);
  assert.doesNotMatch(html, /data-plan|data-price|data-type="purchase"|Choose plan/);
  assert.doesNotMatch(html, /[₹$€]\s?[\d—]/, 'no currency amounts on the page');
  assert.doesNotMatch(html, /payment/i);
  assert.ok((html.match(/data-book/g) || []).length >= 2, 'Book a call buttons are still there');
});

test('Instagram and YouTube links are the Wolf Edit ones', async () => {
  const html = await (await fetch(`${bare.base}/`)).text();
  assert.match(html, /href="https:\/\/instagram\.com\/Wolf_edit"[^>]*>@Wolf_edit</);
  assert.match(html, /href="https:\/\/youtube\.com\/@dewank-h9z"[^>]*>Wolf Edit</);
  assert.doesNotMatch(html, /si=8wzZZGBVs4LK-nGu/, 'tracking parameter is not kept');
  assert.doesNotMatch(html, /dewank_visual|dewankvisuals/);
});

test('without Supabase: config says not configured and booking says so politely', async () => {
  const cfg = await json(await fetch(`${bare.base}/api/config`));
  assert.equal(cfg.configured, false);
  assert.equal(cfg.bookingsReady, false);
  const res = await post(`${bare.base}/api/book`, { name: 'Asha', email: 'asha@example.com' });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).notConfigured, true);
});

test('404 page, robots and sitemap; the Excel export route is gone', async () => {
  const nf = await fetch(`${bare.base}/nope`);
  assert.equal(nf.status, 404);
  assert.match(await nf.text(), /WOLF EDIT/);
  assert.equal((await fetch(`${bare.base}/api/export-bookings`)).status, 404);
  const robots = await (await fetch(`${bare.base}/robots.txt`)).text();
  assert.match(robots, /Sitemap:/);
  assert.match(robots, /Disallow: \/admin/);
  const sm = await fetch(`${bare.base}/sitemap.xml`);
  assert.match(sm.headers.get('content-type'), /xml/);
});

test('no Excel or Google Sheet code is left in the project', () => {
  for (const gone of ['lib/xlsx.js', 'lib/sheets.js', 'api/export-bookings.js', 'docs/google-sheet-apps-script.gs']) {
    assert.ok(!existsSync(join(ROOT, gone)), `${gone} should not exist`);
  }
  const env = readFileSync(join(ROOT, '.env.example'), 'utf8');
  assert.doesNotMatch(env, /SHEET/i);
  const schema = readFileSync(join(ROOT, 'supabase/schema.sql'), 'utf8');
  assert.doesNotMatch(schema, /plan_price|'purchase'|'plans'/);
});

// ------------------------------------------------------------------ config never leaks secrets
test('/api/config exposes the anon key but never the service key', async () => {
  const text = await (await fetch(`${wired.base}/api/config`)).text();
  const cfg = JSON.parse(text);
  assert.equal(cfg.configured, true);
  assert.equal(cfg.supabaseAnonKey, KEYS.anon);
  assert.equal(cfg.bookingsReady, true);
  assert.ok(!text.includes(KEYS.service), 'service key leaked');
});

test('empty database falls back to starter content (noindex)', async () => {
  const html = await (await fetch(`${wired.base}/`)).text();
  assert.match(html, /name="robots" content="noindex/);
});

// ------------------------------------------------------------------ access rules (mock mirrors schema.sql RLS)
test('visitors cannot read bookings or write anything; strangers cannot write', async () => {
  const anonRead = await fetch(`${mockUrl}/rest/v1/bookings?select=*`, { headers: { apikey: KEYS.anon, Authorization: `Bearer ${KEYS.anon}` } });
  assert.ok([401, 403].includes(anonRead.status));
  const anonWrite = await post(`${mockUrl}/rest/v1/projects`, { slug: 'x', title: 'x' }, { apikey: KEYS.anon, Authorization: `Bearer ${KEYS.anon}` });
  assert.ok([401, 403].includes(anonWrite.status));

  const login = await post(`${mockUrl}/auth/v1/token?grant_type=password`, STRANGER, { apikey: KEYS.anon });
  const t = (await login.json()).access_token;
  const strangerWrite = await post(`${mockUrl}/rest/v1/projects`, { slug: 'x', title: 'x' }, { apikey: KEYS.anon, Authorization: `Bearer ${t}` });
  assert.equal(strangerWrite.status, 403);
  const strangerBookings = await (await fetch(`${mockUrl}/rest/v1/bookings?select=*`, { headers: { apikey: KEYS.anon, Authorization: `Bearer ${t}` } })).json();
  assert.deepEqual(strangerBookings, []);
});

// ------------------------------------------------------------------ content published by an admin shows on the live site
test('projects added by the admin appear on the homepage and their own page, in order; drafts stay hidden', async () => {
  const seed = await asAdmin('/rest/v1/site_settings?on_conflict=key', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ key: 'seeded', value: { at: 'now' } }, { key: 'brand', value: { name: 'WOLF EDIT', role: 'Video Editor & Motion Designer', tagline: 'Your vision. My edit. One powerful story.' } }]),
  });
  assert.equal(seed.status, 201);

  const rows = [
    { slug: 'second-reel', title: 'Second Reel', category: 'Reels', video_url: 'https://youtu.be/dQw4w9WgXcQ', position: 1, published: true },
    { slug: 'first-reel', title: 'First <script>alert(1)</script> Reel', category: 'Reels', video_url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', featured: true, position: 0, published: true },
    { slug: 'hidden-draft', title: 'Hidden Draft', video_url: 'https://youtu.be/dQw4w9WgXcQ', position: 2, published: false },
  ];
  const ins = await asAdmin('/rest/v1/projects', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rows) });
  assert.equal(ins.status, 201);

  const html = await (await fetch(`${wired.base}/`)).text();
  assert.doesNotMatch(html, /name="robots" content="noindex/, 'a real site must be indexable');
  assert.ok(html.indexOf('First &lt;script&gt;') > -1, 'title must be escaped');
  assert.ok(!html.includes('<script>alert(1)'), 'raw script tag from content must never appear');
  assert.ok(html.indexOf('First &lt;script&gt;') < html.indexOf('Second Reel'), 'position order is respected');
  assert.ok(!html.includes('Hidden Draft'));
  assert.match(html, /ytimg\.com\/vi\/dQw4w9WgXcQ/);
  assert.match(html, /\/assets\/wolf-edit-logo\.webp/, 'logo default still applies when the brand row has no logo');
  assert.match(html, /"name":"Dewank Saini"/, 'structured data names the owner');
  assert.match(html, /"alternateName":"WOLF EDIT"/);

  const page = await fetch(`${wired.base}/work/second-reel`);
  assert.equal(page.status, 200);
  const pageHtml = await page.text();
  assert.match(pageHtml, /Second Reel/);
  assert.match(pageHtml, /VideoObject/);
  assert.equal((await fetch(`${wired.base}/work/hidden-draft`)).status, 404);

  const sm = await (await fetch(`${wired.base}/sitemap.xml`)).text();
  assert.match(sm, /https:\/\/wolfedit\.example\/work\/second-reel/);
  assert.ok(!sm.includes('hidden-draft'));
});

test('a logo set in the dashboard replaces the bundled one, and clearing it falls back to the brand name', async () => {
  const set = (logo) => asAdmin('/rest/v1/site_settings?on_conflict=key', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ key: 'brand', value: { name: 'WOLF EDIT', logo, role: 'Editor', tagline: 'Tag' } }]),
  });
  await set('https://cdn.example/new-logo.png');
  let html = await (await fetch(`${wired.base}/`)).text();
  assert.match(html, /src="https:\/\/cdn\.example\/new-logo\.png"/);
  await set('javascript:alert(1)');
  html = await (await fetch(`${wired.base}/`)).text();
  assert.doesNotMatch(html, /javascript:alert/, 'unsafe logo links are dropped');
  assert.match(html, /class="brand"[^>]*>WOLF EDIT</, 'falls back to the brand name as text');
  await set('/assets/wolf-edit-logo.webp');
});

// ------------------------------------------------------------------ bookings
const valid = { name: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210', service: 'Reels and short-form', preferred_date: '2026-11-02', preferred_time: 'Evening', message: 'Need 10 reels a month.', source_page: '/' };

test('rejects missing name, bad email, and silently drops honeypot spam', async () => {
  let res = await post(`${wired.base}/api/book`, { ...valid, name: ' ' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).field, 'name');
  res = await post(`${wired.base}/api/book`, { ...valid, email: 'not-an-email' });
  assert.equal(res.status, 422);
  assert.equal((await res.json()).field, 'email');
  const before = mock.state.db.bookings.length;
  res = await post(`${wired.base}/api/book`, { ...valid, website: 'http://spam.example' });
  assert.equal(res.status, 200);
  assert.equal(mock.state.db.bookings.length, before, 'honeypot submissions must not be stored');
});

test('a call request is saved to the database', async () => {
  const res = await post(`${wired.base}/api/book`, valid);
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.ok, true);
  const saved = mock.state.db.bookings.find((b) => b.id === out.id);
  assert.equal(saved.name, 'Asha Verma');
  assert.equal(saved.status, 'new');
  assert.equal(saved.preferred_date, '2026-11-02');
  assert.equal(saved.service, 'Reels and short-form');
  assert.ok(!('plan' in saved) && !('type' in saved), 'no plan or type columns any more');
});

test('odd input is cleaned: free-text dates are dropped, long text is trimmed, old plan fields are ignored', async () => {
  const res = await post(`${wired.base}/api/book`, { ...valid, name: 'Ravi Kumar', email: 'ravi@example.com', preferred_date: 'tomorrow', message: 'x'.repeat(5000), type: 'purchase', plan: 'Growth', plan_price: '12000' });
  assert.equal(res.status, 200);
  const saved = mock.state.db.bookings.find((b) => b.email === 'ravi@example.com');
  assert.equal(saved.preferred_date, '');
  assert.equal(saved.message.length, 2000);
  assert.ok(!('plan' in saved) && !('plan_price' in saved));
});

test('rate limit stops floods from one visitor', async () => {
  let last;
  for (let i = 0; i < 8; i++) last = await post(`${wired.base}/api/book`, { ...valid, name: `Flood ${i}`, email: `f${i}@example.com` });
  assert.equal(last.status, 429);
});

// ------------------------------------------------------------------ video link detection (shared by site and dashboard)
test('video links: YouTube, Shorts, Instagram, Drive, Vimeo, uploads; junk is refused', async () => {
  const { parseVideo, slugify } = await import('../public/shared/media.js');
  const k = (u) => parseVideo(u).source || parseVideo(u).kind;
  assert.equal(k('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(k('https://youtu.be/dQw4w9WgXcQ?t=5'), 'youtube');
  assert.equal(parseVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ').shorts, true);
  assert.match(parseVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ').thumb, /ytimg\.com\/vi\/dQw4w9WgXcQ\//);
  assert.equal(k('https://www.instagram.com/reel/C1a2B3c4D5e/'), 'instagram');
  assert.equal(k('https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing'), 'drive');
  assert.equal(k('https://vimeo.com/123456789'), 'vimeo');
  assert.equal(k('https://abc.supabase.co/storage/v1/object/public/media/videos/1-clip.mp4'), 'upload');
  assert.equal(k('https://example.com/my-edit'), 'link');
  for (const junk of ['', 'not a link', 'hello', 'javascript:alert(1)', 'ftp://x.y', 'data:text/html,<b>x</b>']) {
    assert.equal(parseVideo(junk).kind, '', `should refuse: ${junk}`);
  }
  assert.equal(slugify('Wedding Reel – Final Cut!'), 'wedding-reel-final-cut');
  assert.equal(slugify('!!!'), 'project');
});
