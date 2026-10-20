// GET /api/config  - the public values the admin dashboard needs to talk to Supabase.
// The anon key is meant to be public; row level security protects the data.
import { publicConfig, isConfigured, hasServiceKey } from '../lib/supabase.js';
import { sendJson } from '../lib/util.js';

export default function handler(req, res) {
  sendJson(
    res,
    200,
    {
      configured: isConfigured(),
      ...publicConfig(),
      bookingsReady: isConfigured() && hasServiceKey(),
    },
    { 'Cache-Control': 'no-store' },
  );
}
