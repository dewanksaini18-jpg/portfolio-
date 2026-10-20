// GET /sitemap.xml
import { loadSite } from '../lib/data.js';
import { esc, send, siteUrl } from '../lib/util.js';

export default async function handler(req, res) {
  const site = await loadSite();
  const base = siteUrl(req);
  const urls = [{ loc: `${base}/`, lastmod: new Date().toISOString().slice(0, 10) }];
  if (site.source === 'database') {
    for (const p of site.projects) {
      if (p.is_placeholder) continue;
      urls.push({ loc: `${base}/work/${p.slug}`, lastmod: String(p.updated_at || p.created_at || '').slice(0, 10) });
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;
  send(res, 200, xml, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=300' });
}
