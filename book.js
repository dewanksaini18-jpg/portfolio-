// POST /api/book  - saves a "Book a call" request.
// Stored in the `bookings` table with the service role key (server only).
// You read and manage requests in the dashboard, under Bookings.
import { sb, isConfigured, hasServiceKey } from '../lib/supabase.js';
import { sendJson, readJson, clientIp } from '../lib/util.js';

const hits = new Map(); // best-effort rate limit per server instance
function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 6;
}

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Use POST.' }, { Allow: 'POST' });

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: 'Could not read the form.' });
  }

  // Spam trap: real visitors never see or fill this field.
  if (body.website) return sendJson(res, 200, { ok: true });

  if (tooMany(clientIp(req))) {
    return sendJson(res, 429, { error: 'Too many requests. Please wait a few minutes or use WhatsApp.' });
  }

  const row = {
    name: clean(body.name, 100),
    email: clean(body.email, 160),
    phone: clean(body.phone, 30),
    service: clean(body.service, 120),
    preferred_date: /^\d{4}-\d{2}-\d{2}$/.test(clean(body.preferred_date, 10)) ? clean(body.preferred_date, 10) : '',
    preferred_time: clean(body.preferred_time, 30),
    message: clean(body.message, 2000),
    source_page: clean(body.source_page, 200),
  };

  if (row.name.length < 2) return sendJson(res, 422, { error: 'Please enter your name.', field: 'name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) {
    return sendJson(res, 422, { error: 'Please enter a valid email address.', field: 'email' });
  }

  if (!isConfigured() || !hasServiceKey()) {
    return sendJson(res, 503, { error: 'Booking is not connected yet.', notConfigured: true });
  }

  try {
    const saved = await sb('/rest/v1/bookings', { key: 'service', method: 'POST', body: row, prefer: 'return=representation' });
    const booking = Array.isArray(saved) ? saved[0] : saved;
    return sendJson(res, 200, { ok: true, id: booking?.id });
  } catch (err) {
    console.error('[book] could not save booking:', err.message);
    return sendJson(res, 500, { error: 'Could not save your request. Please try again or use WhatsApp.' });
  }
}
