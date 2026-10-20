// Shared by the server (page rendering) and the admin dashboard (live link detection).
// Pure functions, no dependencies.

const VIDEO_FILE = /\.(mp4|mov|m4v|webm|ogv)$/i;

export const ASPECTS = {
  landscape: { w: 640, h: 360, label: 'Landscape 16:9' },
  portrait: { w: 360, h: 640, label: 'Portrait 9:16' },
  square: { w: 480, h: 480, label: 'Square 1:1' },
};

/**
 * Work out how to show a video link.
 * kind: 'embed' (iframe), 'video' (<video> file), 'link' (open in a new tab) or '' (nothing)
 */
export function parseVideo(input) {
  const empty = { kind: '', source: '', label: '', url: '', embed: '', thumb: '', id: '' };
  const raw = String(input ?? '').trim();
  if (!raw) return empty;

  // Spaces are never part of a link, and only web links are accepted (not ftp:, javascript:, etc.).
  if (/\s/.test(raw)) return empty;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return empty;

  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return empty;
  }
  const host = u.hostname.replace(/^(www|m)\./, '').toLowerCase();
  if (!host.includes('.')) return empty; // "hello" is a word, not a link

  // YouTube (watch, youtu.be, shorts, embed, live)
  let ytId = '';
  if (host === 'youtu.be') ytId = u.pathname.split('/')[1] || '';
  else if (['youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) {
    if (u.pathname === '/watch') ytId = u.searchParams.get('v') || '';
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
      if (m) ytId = m[2];
    }
  }
  if (/^[\w-]{11}$/.test(ytId)) {
    return {
      kind: 'embed',
      source: 'youtube',
      label: 'YouTube',
      url: u.href,
      id: ytId,
      shorts: /\/shorts\//.test(u.pathname),
      embed: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      thumb: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
    };
  }

  // Instagram reels / posts
  if (host === 'instagram.com') {
    const m = u.pathname.match(/^\/(?:[\w.]+\/)?(reel|reels|p|tv)\/([\w-]+)/);
    if (m) {
      const type = m[1] === 'reels' ? 'reel' : m[1];
      return {
        kind: 'embed',
        source: 'instagram',
        label: 'Instagram',
        url: u.href,
        id: m[2],
        embed: `https://www.instagram.com/${type}/${m[2]}/embed/`,
        thumb: '',
      };
    }
  }

  // Google Drive
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    const m = u.pathname.match(/\/file\/d\/([\w-]+)/);
    const id = m ? m[1] : u.searchParams.get('id') || '';
    if (id) {
      return {
        kind: 'embed',
        source: 'drive',
        label: 'Google Drive',
        url: u.href,
        id,
        embed: `https://drive.google.com/file/d/${id}/preview`,
        thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
      };
    }
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/(?:\/video)?\/(\d{6,})/);
    if (m) {
      return {
        kind: 'embed',
        source: 'vimeo',
        label: 'Vimeo',
        url: u.href,
        id: m[1],
        embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`,
        thumb: '',
      };
    }
  }

  // A video file (for example one uploaded from the dashboard)
  if (VIDEO_FILE.test(u.pathname)) {
    return { kind: 'video', source: 'upload', label: 'Video file', url: u.href, embed: '', thumb: '', id: '' };
  }

  return { kind: 'link', source: 'link', label: host, url: u.href, embed: '', thumb: '', id: '' };
}

/** Lowercase, dash-separated, ASCII-safe text for URLs. */
export function slugify(text) {
  const s = String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'project';
}
