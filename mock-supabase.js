// In-memory stand-in for the parts of Supabase this project uses (PostgREST, Auth, Storage).
// It exists so the whole product can be tested without a real project.
//
// It mirrors the schema's constraints and the row level security rules in supabase/schema.sql.
// The real policies are verified separately against Postgres (test/run-schema-test.sh).
//
//   node test/mock-supabase.js          # starts on :3200 with the demo keys below
import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const KEYS = { anon: 'test-anon-key', service: 'test-service-role-key' };
export const ADMIN = { email: 'dewanksaini18@gmail.com', password: 'correct-horse-battery' };
export const STRANGER = { email: 'stranger@example.com', password: 'another-long-password' };

const TABLES = ['admins', 'site_settings', 'projects', 'content_items', 'bookings'];
const PK = { admins: 'user_id', site_settings: 'key' };
const COLLECTIONS = ['services', 'testimonials', 'faq', 'process', 'tools', 'clients', 'stats', 'socials'];
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'video/mp4', 'video/quicktime', 'video/webm'];
const MAX_UPLOAD = 52428800;

const DEFAULTS = {
  site_settings: () => ({ value: {} }),
  projects: () => ({
    id: randomUUID(), description: '', category: '', client: '', video_url: '', thumbnail_url: '',
    aspect: 'landscape', featured: false, published: true, is_placeholder: false, position: 0,
    created_at: new Date().toISOString(),
  }),
  content_items: () => ({ id: randomUUID(), position: 0, data: {}, published: true, created_at: new Date().toISOString() }),
  bookings: () => ({
    id: randomUUID(), created_at: new Date().toISOString(), phone: '', service: '',
    preferred_date: '', preferred_time: '', message: '', source_page: '', status: 'new', notes: '',
  }),
  admins: () => ({ created_at: new Date().toISOString() }),
};

const REQUIRED = {
  projects: ['slug', 'title'],
  bookings: ['name', 'email'],
  content_items: ['collection'],
  site_settings: ['key'],
  admins: ['user_id'],
};

class PgError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function createMock({ anonKey = KEYS.anon, serviceKey = KEYS.service } = {}) {
  const state = {
    db: Object.fromEntries(TABLES.map((t) => [t, []])),
    users: [],
    sessions: new Map(), // access token -> { user, expires }
    refresh: new Map(), // refresh token -> user id
    files: new Map(), // path -> { type, body }
    log: [],
    resets: [],
  };

  const addUser = (email, password, { admin = false } = {}) => {
    const user = { id: randomUUID(), email, password, role: 'authenticated', aud: 'authenticated' };
    state.users.push(user);
    if (admin) state.db.admins.push({ user_id: user.id, created_at: new Date().toISOString() });
    return user;
  };
  const admin = addUser(ADMIN.email, ADMIN.password, { admin: true });
  const stranger = addUser(STRANGER.email, STRANGER.password);

  const issue = (user, ttl = 3600) => {
    const access = `at_${randomUUID()}`;
    const refresh = `rt_${randomUUID()}`;
    state.sessions.set(access, { userId: user.id, expires: Date.now() + ttl * 1000 });
    state.refresh.set(refresh, user.id);
    return { access_token: access, refresh_token: refresh, token_type: 'bearer', expires_in: ttl, user: pub(user) };
  };
  const pub = (u) => ({ id: u.id, email: u.email, role: u.role, aud: u.aud });

  // ---- who is calling? ----
  function whoami(req) {
    const apikey = req.headers.apikey || '';
    const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (apikey === serviceKey && (!bearer || bearer === serviceKey)) return { role: 'service', admin: true };
    if (bearer === serviceKey) return { role: 'service', admin: true };
    const sess = state.sessions.get(bearer);
    if (sess) {
      if (sess.expires < Date.now()) return { role: 'expired' };
      const user = state.users.find((u) => u.id === sess.userId);
      return { role: 'authenticated', user, admin: state.db.admins.some((a) => a.user_id === user.id) };
    }
    if (apikey === anonKey) return { role: 'anon', admin: false };
    return { role: 'invalid' };
  }

  // ---- PostgREST-ish helpers ----
  const unq = (s) => decodeURIComponent(s);
  function filtersFrom(params) {
    const out = [];
    for (const [k, v] of params) {
      if (['select', 'order', 'on_conflict', 'limit', 'offset', 'columns'].includes(k)) continue;
      const m = /^(eq|neq|in|is)\.(.*)$/.exec(v);
      if (!m) throw new PgError(400, 'PGRST100', `unsupported filter ${k}=${v}`);
      out.push({ col: k, op: m[1], val: m[2] });
    }
    return out;
  }
  const same = (a, b) => String(a) === String(b);
  function matches(row, f) {
    const v = row[f.col];
    if (f.op === 'eq') return same(v, f.val);
    if (f.op === 'neq') return !same(v, f.val);
    if (f.op === 'is') return f.val === 'null' ? v == null : same(v, f.val);
    if (f.op === 'in') return f.val.replace(/^\(|\)$/g, '').split(',').some((x) => same(v, x.replace(/^"|"$/g, '')));
    return false;
  }
  function sortRows(rows, order) {
    if (!order) return rows;
    const keys = order.split(',').map((p) => { const [c, d = 'asc'] = p.split('.'); return { c, d }; });
    return [...rows].sort((a, b) => {
      for (const { c, d } of keys) {
        const x = a[c], y = b[c];
        if (x === y) continue;
        const r = x > y ? 1 : -1;
        return d === 'desc' ? -r : r;
      }
      return 0;
    });
  }
  const project = (rows, select) => {
    if (!select || select === '*') return rows;
    const cols = select.split(',').map((c) => c.trim());
    return rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
  };

  // Row level security, as in schema.sql
  function canSee(table, row, who) {
    if (who.role === 'service') return true;
    if (table === 'admins') return who.role === 'authenticated' && row.user_id === who.user.id;
    if (table === 'bookings') return who.role === 'authenticated' && who.admin;
    if (table === 'site_settings') return who.role === 'anon' || who.role === 'authenticated';
    if (table === 'projects' || table === 'content_items') {
      if (who.role === 'authenticated' && who.admin) return true;
      return (who.role === 'anon' || who.role === 'authenticated') && row.published === true;
    }
    return false;
  }
  const canRead = (table, who) => {
    if (who.role === 'service') return true;
    if (table === 'bookings') return who.role === 'authenticated';
    if (table === 'admins') return who.role === 'authenticated';
    return who.role === 'anon' || who.role === 'authenticated';
  };
  const canWrite = (table, who) => who.role === 'service' || (who.role === 'authenticated' && who.admin && table !== 'admins');

  function validate(table, row) {
    for (const col of REQUIRED[table] || []) {
      if (row[col] === undefined || row[col] === null || row[col] === '') {
        if (col === 'name' || col === 'email' || col === 'title' || col === 'slug' || col === 'key' || col === 'collection' || col === 'user_id') {
          throw new PgError(400, '23502', `null value in column "${col}" of relation "${table}" violates not-null constraint`);
        }
      }
    }
    if (table === 'projects' && !['landscape', 'portrait', 'square'].includes(row.aspect)) throw new PgError(400, '23514', 'new row for relation "projects" violates check constraint "projects_aspect_check"');
    if (table === 'content_items' && !COLLECTIONS.includes(row.collection)) throw new PgError(400, '23514', 'new row for relation "content_items" violates check constraint "content_items_collection_check"');
    if (table === 'bookings') {
      if (!['new', 'contacted', 'confirmed', 'completed', 'cancelled'].includes(row.status)) throw new PgError(400, '23514', 'new row for relation "bookings" violates check constraint "bookings_status_check"');
    }
    if (table === 'projects') {
      const dupe = state.db.projects.find((p) => p.slug === row.slug && p.id !== row.id);
      if (dupe) throw new PgError(409, '23505', 'duplicate key value violates unique constraint "projects_slug_key"');
    }
  }

  function rest(req, res, url, who, bodyText) {
    const table = url.pathname.split('/')[3];
    if (!TABLES.includes(table)) throw new PgError(404, 'PGRST205', `Could not find the table 'public.${table}' in the schema cache`);
    const params = url.searchParams;
    const prefer = String(req.headers.prefer || '');
    const wantRows = /return=representation/.test(prefer);
    const rows = state.db[table];
    const pk = PK[table] || 'id';

    if (req.method === 'GET') {
      if (!canRead(table, who)) throw new PgError(401, '42501', `permission denied for table ${table}`);
      let out = rows.filter((r) => canSee(table, r, who) && filtersFrom(params).every((f) => matches(r, f)));
      out = sortRows(out, params.get('order'));
      return [200, project(out, params.get('select'))];
    }

    if (!canWrite(table, who)) {
      if (who.role === 'anon') throw new PgError(401, '42501', `permission denied for table ${table}`);
      if (req.method === 'POST') throw new PgError(403, '42501', `new row violates row-level security policy for table "${table}"`);
      return [req.method === 'DELETE' ? 204 : 200, req.method === 'DELETE' ? null : []]; // RLS hides rows: nothing changes
    }

    const body = bodyText ? JSON.parse(bodyText) : undefined;

    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const onConflict = params.get('on_conflict');
      const merge = /resolution=merge-duplicates/.test(prefer);
      const touched = [];
      for (const input of list) {
        const key = onConflict || pk;
        const existing = rows.find((r) => same(r[key], input[key]) && input[key] !== undefined);
        if (existing && merge) {
          Object.assign(existing, input, { updated_at: new Date().toISOString() });
          validate(table, existing);
          touched.push(existing);
          continue;
        }
        if (existing && (table === 'site_settings' || table === 'admins')) throw new PgError(409, '23505', `duplicate key value violates unique constraint "${table}_pkey"`);
        const row = { ...DEFAULTS[table](), ...input };
        if (table === 'site_settings' || table === 'projects' || table === 'content_items') row.updated_at = row.updated_at || new Date().toISOString();
        validate(table, row);
        rows.push(row);
        touched.push(row);
      }
      return [201, wantRows ? touched : null];
    }

    const matched = rows.filter((r) => filtersFrom(params).every((f) => matches(r, f)));
    if (req.method === 'PATCH') {
      for (const r of matched) {
        const next = { ...r, ...body, updated_at: new Date().toISOString() };
        validate(table, next);
        Object.assign(r, next);
      }
      return [200, wantRows ? matched : null];
    }
    if (req.method === 'DELETE') {
      for (const r of matched) rows.splice(rows.indexOf(r), 1);
      if (table === 'bookings' || table === 'projects') void pk;
      return [204, null];
    }
    throw new PgError(405, 'PGRST000', 'method not allowed');
  }

  function auth(req, res, url, bodyText) {
    const body = bodyText ? JSON.parse(bodyText) : {};
    const route = url.pathname.replace('/auth/v1', '');
    if (route === '/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = state.users.find((x) => x.email === String(body.email).toLowerCase() && x.password === body.password);
        if (!u) return [400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }];
        return [200, issue(u, state.ttl || 3600)];
      }
      if (grant === 'refresh_token') {
        const id = state.refresh.get(body.refresh_token);
        if (!id) return [400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }];
        state.refresh.delete(body.refresh_token);
        return [200, issue(state.users.find((u) => u.id === id))];
      }
    }
    if (route === '/user') {
      const who = whoami(req);
      if (who.role !== 'authenticated') return [401, { code: 401, msg: 'invalid JWT' }];
      if (req.method === 'GET') return [200, pub(who.user)];
      if (req.method === 'PUT') {
        if (!body.password || String(body.password).length < 8) return [422, { code: 422, msg: 'Password should be at least 8 characters.' }];
        who.user.password = body.password;
        return [200, pub(who.user)];
      }
    }
    if (route === '/logout') return [204, null];
    if (route === '/recover') { state.resets.push(body.email); return [200, {}]; }
    return [404, { msg: 'not found' }];
  }

  function storage(req, res, url, who, chunks) {
    const m = /^\/storage\/v1\/object\/(public\/)?media\/(.+)$/.exec(url.pathname);
    if (!m) return [404, { message: 'Bucket not found' }];
    const path = unq(m[2]);
    if (m[1]) {
      const f = state.files.get(path);
      if (!f) return [404, { message: 'Object not found' }];
      return [200, f.body, { 'Content-Type': f.type, 'Cache-Control': 'public, max-age=3600' }, true];
    }
    if (!(who.role === 'service' || (who.role === 'authenticated' && who.admin))) {
      return [403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }];
    }
    if (req.method === 'POST') {
      const body = Buffer.concat(chunks);
      const type = req.headers['content-type'] || '';
      if (!MIME_OK.includes(type)) return [415, { statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported` }];
      if (body.length > MAX_UPLOAD) return [413, { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' }];
      if (state.files.has(path)) return [409, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }];
      state.files.set(path, { type, body });
      return [200, { Key: `media/${path}` }];
    }
    if (req.method === 'DELETE') { state.files.delete(path); return [200, { message: 'Successfully deleted' }]; }
    return [405, { message: 'method not allowed' }];
  }

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://mock');
      const cors = {
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Headers': 'apikey, authorization, content-type, prefer, x-upsert, cache-control, x-client-info',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Expose-Headers': 'Content-Range',
        Vary: 'Origin',
      };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

      if (url.pathname === '/__state') { // test-only peek at what is stored
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ db: state.db, files: [...state.files.keys()], log: state.log, resets: state.resets }));
      }

      if (url.pathname === '/__expire') { for (const x of state.sessions.values()) x.expires = Date.now() - 1000; res.writeHead(200, cors); return res.end('ok'); }

      const who = whoami(req);
      state.log.push({
        method: req.method, path: url.pathname, role: who.role, origin: req.headers.origin || '',
        usedServiceKey: req.headers.apikey === serviceKey || String(req.headers.authorization || '').includes(serviceKey),
      });

      let status = 200, payload = null, extra = {}, raw = false;
      try {
        if (who.role === 'invalid' && !url.pathname.startsWith('/storage/v1/object/public/')) throw new PgError(401, 'PGRST301', 'Invalid API key');
        if (who.role === 'expired' && url.pathname.startsWith('/rest/')) throw new PgError(401, 'PGRST301', 'JWT expired');
        const bodyText = Buffer.concat(chunks).toString('utf8');
        if (url.pathname.startsWith('/rest/v1/')) [status, payload] = rest(req, res, url, who, bodyText);
        else if (url.pathname.startsWith('/auth/v1/')) [status, payload] = auth(req, res, url, bodyText);
        else if (url.pathname.startsWith('/storage/v1/')) [status, payload, extra = {}, raw = false] = storage(req, res, url, who, chunks);
        else [status, payload] = [404, { message: 'not found' }];
      } catch (err) {
        if (err instanceof PgError) [status, payload] = [err.status, { code: err.code, message: err.message, details: null, hint: null }];
        else { console.error('[mock]', err); [status, payload] = [500, { message: String(err.message) }]; }
      }
      if (raw) { res.writeHead(status, { ...cors, ...extra }); return res.end(payload); }
      const text = payload === null || payload === undefined ? '' : JSON.stringify(payload);
      res.writeHead(status, { ...cors, 'Content-Type': 'application/json', ...extra });
      res.end(status === 204 ? undefined : text);
    });
  });

  return {
    server, state, admin, stranger, anonKey, serviceKey,
    listen: (port = 0) => new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(resolve); }),
    // test helper: make every access token look expired
    expireAll: () => { for (const s of state.sessions.values()) s.expires = Date.now() - 1000; },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mock = createMock();
  const port = await mock.listen(Number(process.env.MOCK_PORT) || 3200);
  console.log(`Mock Supabase on http://127.0.0.1:${port}`);
  console.log(`  anon key:    ${KEYS.anon}\n  service key: ${KEYS.service}\n  admin login: ${ADMIN.email} / ${ADMIN.password}`);
}
