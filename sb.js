// Minimal Supabase client for the dashboard: sign-in, database calls and file uploads.
// Security does not depend on this file: every write is checked by row level security on the server.

const STORE = 'dsp-admin-session-v1';
let cfg = null;
let session = null;

export const uploadLimitMb = 50;

export async function init() {
  const res = await fetch('/api/config', { cache: 'no-store' });
  cfg = await res.json();
  try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { session = null; }
  return cfg;
}
export const config = () => cfg;
export const user = () => session?.user || null;
export const token = () => session?.access_token || '';
export const signedIn = () => Boolean(session?.access_token);

function save(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORE, JSON.stringify(next));
    else localStorage.removeItem(STORE);
  } catch { /* private mode: stay signed in for this tab only */ }
}

function headers(extra = {}) {
  const h = { apikey: cfg.supabaseAnonKey, ...extra };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  else if (!cfg.supabaseAnonKey.startsWith('sb_')) h.Authorization = `Bearer ${cfg.supabaseAnonKey}`;
  return h;
}

async function errorFrom(res) {
  let body = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  const msg = body?.error_description || body?.msg || body?.message || body?.error || res.statusText || 'Request failed';
  return Object.assign(new Error(msg), { status: res.status, body });
}

function setSession(j) {
  save({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
    user: j.user,
  });
}

export async function signIn(email, password) {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const e = await errorFrom(res);
    throw new Error(/invalid login/i.test(e.message) ? 'That email or password is not right.' : e.message);
  }
  setSession(await res.json());
}

async function refresh() {
  if (!session?.refresh_token) throw new Error('No session');
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) throw await errorFrom(res);
  setSession(await res.json());
}

async function fresh() {
  if (!session) throw Object.assign(new Error('Please sign in.'), { auth: true });
  if (session.expires_at - 60 < Date.now() / 1000) {
    try { await refresh(); } catch {
      save(null);
      throw Object.assign(new Error('Your session expired. Please sign in again.'), { auth: true });
    }
  }
}

export async function signOut() {
  try {
    if (session) await fetch(`${cfg.supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: headers() });
  } catch { /* ignore */ }
  save(null);
}

export async function sendReset(email) {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await errorFrom(res);
}

export async function changePassword(password) {
  await fresh();
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/user`, {
    method: 'PUT',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw await errorFrom(res);
}

async function call(path, { method = 'GET', body, prefer } = {}) {
  await fresh();
  const send = () =>
    fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
      method,
      headers: headers({ 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  let res = await send();
  if (res.status === 401) {
    try { await refresh(); res = await send(); } catch { save(null); throw Object.assign(new Error('Your session expired. Please sign in again.'), { auth: true }); }
  }
  if (!res.ok) throw await errorFrom(res);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const q = (v) => encodeURIComponent(String(v));

export const db = {
  list: (table, query = 'select=*') => call(`${table}?${query}`),
  insert: (table, rows) => call(table, { method: 'POST', body: rows, prefer: 'return=representation' }),
  update: (table, id, patch) => call(`${table}?id=eq.${q(id)}`, { method: 'PATCH', body: patch, prefer: 'return=representation' }),
  remove: (table, id) => call(`${table}?id=eq.${q(id)}`, { method: 'DELETE' }),
  upsert: (table, rows, onConflict) => call(`${table}?on_conflict=${q(onConflict)}`, { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=representation' }),
};

// ---------- Files ----------
export const publicUrl = (path) => `${cfg.supabaseUrl}/storage/v1/object/public/media/${path}`;
const PUBLIC_PREFIX = () => `${cfg.supabaseUrl}/storage/v1/object/public/media/`;

/** Shrink big photos before upload (faster on phones, faster for visitors). */
async function shrinkImage(file, max = 1800) {
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 600_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.86));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

/** Upload a file to the public "media" bucket. Resolves with its public URL. */
export async function upload(file, { folder = 'uploads', image = false, onProgress } = {}) {
  await fresh();
  const body = image ? await shrinkImage(file) : file;
  if (body.size > uploadLimitMb * 1024 * 1024) {
    throw new Error(`That file is over ${uploadLimitMb} MB. Upload the video to YouTube or Google Drive and paste the link instead.`);
  }
  const clean = body.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
  const path = `${folder}/${Date.now()}-${clean}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${cfg.supabaseUrl}/storage/v1/object/media/${path}`);
    const h = headers({ 'x-upsert': 'false', 'cache-control': 'max-age=31536000' });
    for (const [k, v] of Object.entries(h)) xhr.setRequestHeader(k, v);
    xhr.setRequestHeader('Content-Type', body.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(publicUrl(path));
      let msg = 'Upload failed.';
      try {
        const j = JSON.parse(xhr.responseText);
        msg = j.message || j.error || msg;
        if (/exceeded|too large|maximum allowed size/i.test(msg)) msg = `That file is too large for your plan. Upload the video to YouTube or Google Drive and paste the link instead.`;
        if (/mime|not supported/i.test(msg)) msg = 'That file type is not allowed. Use JPG, PNG, WebP, MP4, MOV or WebM.';
        if (/row-level|policy|unauthorized/i.test(msg)) msg = 'This account is not allowed to upload. Check that it is listed as an admin.';
      } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.send(body);
  });
}

/** Best effort: delete an uploaded file when its project is deleted. */
export async function removeUploaded(url) {
  try {
    if (!url || !url.startsWith(PUBLIC_PREFIX())) return;
    await fresh();
    const path = url.slice(PUBLIC_PREFIX().length).split('?')[0];
    await fetch(`${cfg.supabaseUrl}/storage/v1/object/media/${path}`, { method: 'DELETE', headers: headers() });
  } catch { /* leave the file; not critical */ }
}
