// GET /robots.txt
import { send, siteUrl } from '../lib/util.js';

export default function handler(req, res) {
  const base = siteUrl(req);
  send(res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=0, s-maxage=3600',
  });
}
