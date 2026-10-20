// Tiny Supabase REST helper for server code (works with legacy JWT keys and the new sb_ keys).

const cfg = () => ({
  url: (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  anon: (process.env.SUPABASE_ANON_KEY || '').trim(),
  service: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
});

export const isConfigured = () => {
  const c = cfg();
  return Boolean(c.url && c.anon);
};
export const hasServiceKey = () => Boolean(cfg().service);
export const publicConfig = () => {
  const c = cfg();
  return { supabaseUrl: c.url, supabaseAnonKey: c.anon };
};

/**
 * Call Supabase.
 *   key:   which project key to send as `apikey` ('anon' | 'service')
 *   token: optional user access token (JWT) for the Authorization header
 */
export async function sb(path, { key = 'anon', token, method = 'GET', body, prefer, timeout = 8000 } = {}) {
  const c = cfg();
  const apikey = key === 'service' ? c.service : c.anon;
  if (!c.url || !apikey) throw Object.assign(new Error('Supabase is not configured'), { status: 503 });

  const headers = { apikey, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  else if (!apikey.startsWith('sb_')) headers.Authorization = `Bearer ${apikey}`; // legacy JWT keys
  if (prefer) headers.Prefer = prefer;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(c.url + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const message = (data && (data.message || data.msg || data.error_description || data.error)) || res.statusText;
      throw Object.assign(new Error(`Supabase ${res.status}: ${message}`), { status: res.status, data });
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
