// GET /  - the portfolio homepage, rendered on the server.
import { loadSite } from '../lib/data.js';
import { renderHome } from '../lib/render.js';
import { send, siteUrl } from '../lib/util.js';

export default async function handler(req, res) {
  const site = await loadSite();
  req.siteUrl = siteUrl(req);
  const html = renderHome(site, req);
  // The CDN keeps a copy for 30 seconds, so edits in the dashboard show up almost immediately.
  const cache =
    site.source === 'database'
      ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=300'
      : 'public, max-age=0, s-maxage=5';
  send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': cache });
}
