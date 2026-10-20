// GET /work/:slug  - one project page (good for search engines and sharing).
import { loadProject } from '../lib/data.js';
import { renderProject, render404 } from '../lib/render.js';
import { send, siteUrl } from '../lib/util.js';

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  const slug = (url.searchParams.get('slug') || url.pathname.split('/').filter(Boolean)[1] || '').toLowerCase();
  const { site, project } = await loadProject(slug);
  req.siteUrl = siteUrl(req);
  if (!project) {
    return send(res, 404, render404(site, req), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=10' });
  }
  send(res, 200, renderProject(site, project, req), {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': site.source === 'database' ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' : 'public, max-age=0, s-maxage=5',
  });
}
