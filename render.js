// Server-side HTML for the public site. Plain template strings, no framework:
// the page arrives as finished HTML (fast, and search engines can read it).
import { esc, digits, safeUrl, safeColor, jsonForScript, lines } from './util.js';
import { parseVideo, ASPECTS } from '../public/shared/media.js';

const ASSET_V = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.ASSET_VERSION || 'dev').slice(0, 8);

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M8 5.2v13.6a.6.6 0 0 0 .92.5l10.6-6.8a.6.6 0 0 0 0-1L8.92 4.7A.6.6 0 0 0 8 5.2Z"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/></svg>',
  chat: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.9 3 3 6.6 3 11.1c0 2.2 1 4.2 2.6 5.6L5 21l4.2-1.9c.9.2 1.8.4 2.8.4 5.1 0 9-3.6 9-8.4S17.1 3 12 3Z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const onColor = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? '#0a0c05' : '#ffffff';
};

const paragraphs = (text) =>
  String(text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

// A site path (/assets/...) or a full http(s) link; anything else is dropped.
const assetUrl = (v) => {
  const t = String(v ?? '').trim();
  return /^\/(?!\/)[\w./%-]+$/.test(t) ? t : safeUrl(t);
};

const items = (site, name) => (site.collections[name] || []).map((i) => i.data || {});
const ghost = (d) => (d && d.placeholder ? ' is-ghost' : '');

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export function layout({ site, req, path = '/', title, description, ogImage, noindex, jsonld, body, bodyClass = '' }) {
  const s = site.settings;
  const base = (req.siteUrl || '').replace(/\/+$/, '');
  const accent = safeColor(s.theme?.accent);
  const canonical = base + (path === '/' ? '/' : path);
  const rawImg = assetUrl(ogImage || s.seo?.og_image);
  const img = rawImg.startsWith('/') ? base + rawImg : rawImg;
  const robots = noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#0d0e0f">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.png" type="image/png" sizes="128x128">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(s.brand.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${img ? `<meta name="twitter:image" content="${esc(img)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,300..800&family=Manrope:wght@400..800&display=swap">
<link rel="stylesheet" href="/assets/site.css?v=${ASSET_V}">
<style>:root{--lime:${accent};--on-lime:${onColor(accent)}}</style>
${jsonld ? `<script type="application/ld+json">${jsonForScript(jsonld)}</script>` : ''}
</head>
<body class="${esc(bodyClass)}">
<a class="skip" href="#main">Skip to content</a>
<div class="playhead" aria-hidden="true"><i></i></div>
${body}
<script src="/assets/site.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

function brandMark(brand, cls) {
  const logo = assetUrl(brand.logo);
  const inner = logo
    ? `<img src="${esc(logo)}" alt="${esc(brand.name)}" width="110" height="34" decoding="async">`
    : esc(brand.name);
  return `<a class="${cls}${logo ? ' has-logo' : ''}" href="/" aria-label="${esc(brand.name)}, home">${inner}</a>`;
}

function nav(site, home) {
  const s = site.settings;
  const h = home ? '' : '/';
  const links = [
    ['work', 'Work', site.projects.length > 0],
    ['services', 'Services', items(site, 'services').length > 0],
    ['about', 'About', true],
    ['process', 'Process', items(site, 'process').length > 0],
    ['faq', 'FAQ', items(site, 'faq').length > 0],
    ['contact', 'Contact', true],
  ]
    .filter((l) => l[2])
    .map(([id, label]) => `<a href="${h}#${id}">${label}</a>`)
    .join('');
  const bookBtn = s.booking?.enabled !== false ? `<button class="btn btn-lime btn-sm" type="button" data-book data-type="call">Book a call</button>` : '';
  return `<header class="nav" id="top">
  <div class="wrap nav-in">
    ${brandMark(s.brand, 'brand')}
    <nav class="nav-links" id="menu" aria-label="Primary">${links}</nav>
    <span class="tc" id="tc" aria-hidden="true">00:00:00:00</span>
    ${bookBtn}
    <button class="burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Open menu"><i></i><i></i></button>
  </div>
</header>`;
}

// ---------------------------------------------------------------------------
// Clips (project cards)
// ---------------------------------------------------------------------------
function thumbOf(p) {
  return safeUrl(p.thumbnail_url) || parseVideo(p.video_url).thumb || '';
}

function clip(p, { eager = false } = {}) {
  const aspect = ASPECTS[p.aspect] ? p.aspect : 'landscape';
  const dim = ASPECTS[aspect];
  const v = parseVideo(p.video_url);
  const thumb = thumbOf(p);
  const media = thumb
    ? `<img src="${esc(thumb)}" width="${dim.w}" height="${dim.h}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" data-thumb>`
    : '<span class="bars" aria-hidden="true"></span>';
  const inner = `<span class="clip-media">${media}</span>
      <span class="clip-info"><span class="clip-cat">${esc(p.category || 'Project')}</span><span class="clip-title">${esc(p.title)}</span></span>`;
  const cat = esc(p.category || '');

  if (p.is_placeholder || !v.kind) {
    return `<li class="clip clip-${aspect} is-ghost" data-cat="${cat}"><div class="clip-open">${inner}<span class="clip-note">Your video here</span></div></li>`;
  }
  if (v.kind === 'link') {
    return `<li class="clip clip-${aspect}" data-cat="${cat}"><a class="clip-open" href="${esc(v.url)}" target="_blank" rel="noopener" aria-label="Open ${esc(p.title)} (new tab)">${inner}<span class="clip-play">${ICON.play}</span></a></li>`;
  }
  const play = {
    k: v.kind,
    src: v.kind === 'embed' ? v.embed : v.url,
    title: p.title,
    cat: p.category || '',
    aspect: v.shorts ? 'portrait' : aspect,
    page: `/work/${p.slug}`,
  };
  return `<li class="clip clip-${aspect}" data-cat="${cat}"><button class="clip-open" type="button" data-play="${esc(JSON.stringify(play))}" aria-label="Play ${esc(p.title)}">${inner}<span class="clip-play">${ICON.play}</span></button></li>`;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
const head = (title, text = '') =>
  `<header class="sec-head"><div class="cut" aria-hidden="true"><i></i></div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</header>`;

function hero(site) {
  const s = site.settings;
  const words = String(s.brand.name).trim().split(/\s+/);
  const logo = assetUrl(s.brand.logo);
  const nameLines = logo
    ? `<img class="hero-logo" src="${esc(logo)}" alt="${esc(s.brand.name)}" width="863" height="266" fetchpriority="high" decoding="async">`
    : words.map((w, i) => `<span class="wipe w${i + 1}">${esc(w)}</span>`).join('');
  const reel = parseVideo(s.hero.showreel_url);
  const poster = safeUrl(s.hero.showreel_poster) || reel.thumb;
  const playData = reel.kind === 'embed' || reel.kind === 'video'
    ? esc(JSON.stringify({ k: reel.kind, src: reel.kind === 'embed' ? reel.embed : reel.url, title: `${s.brand.name} showreel`, cat: 'Showreel', aspect: 'landscape', page: '' }))
    : '';
  const screen = poster
    ? `<img src="${esc(poster)}" alt="" width="1280" height="720" decoding="async" data-thumb>`
    : '<span class="bars" aria-hidden="true"></span>';
  const control = playData
    ? `<button class="monitor-play" type="button" data-play="${playData}" aria-label="Play showreel">${ICON.play}<span>Play showreel</span></button>`
    : reel.kind === 'link'
      ? `<a class="monitor-play" href="${esc(reel.url)}" target="_blank" rel="noopener">${ICON.play}<span>Watch showreel</span></a>`
      : `<span class="monitor-empty">Showreel coming soon</span>`;
  const avail = s.brand.availability_on
    ? `<p class="avail"><i aria-hidden="true"></i>${esc(s.brand.availability_text)}</p>`
    : '';
  const book = s.booking?.enabled !== false
    ? `<button class="btn btn-lime" type="button" data-book data-type="call">${esc(s.hero.cta_primary)}</button>`
    : `<a class="btn btn-lime" href="#contact">${esc(s.hero.cta_primary)}</a>`;

  return `<section class="hero" id="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      ${avail}
      <h1 class="hero-name${logo ? ' has-logo' : ''}"${logo ? '' : ` aria-label="${esc(s.brand.name)}"`}>${nameLines}</h1>
      <p class="hero-role">${esc(s.brand.role)}</p>
      <p class="hero-tag">${esc(s.brand.tagline)}</p>
      <p class="hero-intro">${esc(s.hero.intro)}</p>
      <div class="hero-cta">${book}<a class="btn btn-ghost" href="#work">${esc(s.hero.cta_secondary)}</a></div>
    </div>
    <div class="monitor" aria-label="Showreel player">
      <div class="monitor-screen">${screen}${control}<i class="mk mk-a"></i><i class="mk mk-b"></i><i class="mk mk-c"></i><i class="mk mk-d"></i></div>
      <div class="monitor-bar"><span class="rec"><i aria-hidden="true"></i>Showreel</span><span class="scrub" aria-hidden="true"><i></i></span><span class="monitor-tc" aria-hidden="true">00:00:00:00</span></div>
    </div>
  </div>
</section>`;
}

function proof(site) {
  const clients = items(site, 'clients');
  const stats = items(site, 'stats');
  if (!clients.length && !stats.length) return '';
  const logos = clients
    .map((c) => {
      const logo = safeUrl(c.logo);
      const inner = logo
        ? `<img src="${esc(logo)}" alt="${esc(c.name)}" height="28" loading="lazy" decoding="async">`
        : `<span>${esc(c.name)}</span>`;
      const link = safeUrl(c.url);
      return `<li class="${ghost(c).trim()}">${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${inner}</a>` : inner}</li>`;
    })
    .join('');
  const nums = stats
    .map((t) => `<div class="stat${ghost(t)}"><dt>${esc(t.label)}</dt><dd>${esc(t.value)}</dd></div>`)
    .join('');
  return `<section class="proof" aria-label="Clients and numbers"><div class="wrap proof-in">
    ${clients.length ? `<ul class="clients">${logos}</ul>` : ''}
    ${stats.length ? `<dl class="stats">${nums}</dl>` : ''}
  </div></section>`;
}

function work(site) {
  const all = site.projects;
  if (!all.length) return '';
  const featured = all.filter((p) => p.featured);
  const strip = (featured.length ? featured : all.slice(0, 6));
  const cats = [...new Set(all.map((p) => (p.category || '').trim()).filter(Boolean))];
  const showGrid = all.length > strip.length || cats.length > 1;
  return `<section class="section" id="work">
  <div class="wrap">${head('Selected work', 'Select a frame to play it.')}</div>
  <div class="reel" data-reel>
    <div class="wrap reel-ctl"><button class="round" type="button" data-reel-prev aria-label="Previous projects">${ICON.left}</button><button class="round" type="button" data-reel-next aria-label="Next projects">${ICON.right}</button></div>
    <ul class="reel-track" tabindex="0" aria-label="Featured projects. Scroll sideways to see more.">${strip.map((p, i) => clip(p, { eager: i < 2 })).join('')}</ul>
  </div>
  ${showGrid ? `<div class="wrap all-work">
    <div class="all-head"><h3>All projects</h3>
    ${cats.length > 1 ? `<div class="filters" role="group" aria-label="Filter projects by category"><button class="chip is-on" type="button" data-filter="*">All</button>${cats.map((c) => `<button class="chip" type="button" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>
    <ul class="grid">${all.map((p) => clip(p)).join('')}</ul>
  </div>` : ''}
</section>`;
}

function services(site) {
  const list = items(site, 'services');
  if (!list.length) return '';
  const rows = list
    .map(
      (d) => `<li class="svc${ghost(d)}"><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p>${lines(d.deliverables).length ? `<ul class="tags">${lines(d.deliverables).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</li>`,
    )
    .join('');
  return `<section class="section" id="services"><div class="wrap">${head('What I make', 'Edits for creators and brands, built for the screen they will be watched on.')}<ul class="svc-list">${rows}</ul></div></section>`;
}

function about(site) {
  const a = site.settings.about;
  const b = site.settings.brand;
  const photo = safeUrl(a.photo);
  const initials = String(b.name).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const frame = photo
    ? `<img src="${esc(photo)}" alt="${esc(b.name)}" width="640" height="800" loading="lazy" decoding="async">`
    : `<span class="monogram" aria-hidden="true">${esc(initials)}</span>`;
  return `<section class="section" id="about"><div class="wrap about-grid">
    <figure class="portrait${photo ? '' : ' is-ghost'}">${frame}<i class="mk mk-a"></i><i class="mk mk-b"></i><i class="mk mk-c"></i><i class="mk mk-d"></i></figure>
    <div class="about-copy${ghost(a)}">
      <h2>${esc(a.heading)}</h2>
      ${paragraphs(a.bio)}
      <dl class="facts">
        ${b.owner ? `<div><dt>Editor</dt><dd>${esc(b.owner)}</dd></div>` : ''}
        <div><dt>Role</dt><dd>${esc(b.role)}</dd></div>
        ${a.location ? `<div><dt>Based in</dt><dd>${esc(a.location)}</dd></div>` : ''}
      </dl>
    </div>
  </div></section>`;
}

function processSteps(site) {
  const list = items(site, 'process');
  if (!list.length) return '';
  return `<section class="section" id="process"><div class="wrap">${head('How a project runs', 'From first message to final export.')}
  <ol class="steps">${list.map((d, i) => `<li class="step${ghost(d)}"><span class="step-n">${i + 1}</span><h3>${esc(d.title)}</h3><p>${esc(d.description)}</p></li>`).join('')}</ol></div></section>`;
}

function tools(site) {
  const list = items(site, 'tools');
  if (!list.length) return '';
  return `<section class="section section-tight" id="tools"><div class="wrap">${head('Tools I edit with')}
  <ul class="tools">${list.map((d) => `<li>${esc(d.name)}</li>`).join('')}</ul></div></section>`;
}

function testimonials(site) {
  const list = items(site, 'testimonials');
  if (!list.length) return '';
  const cards = list
    .map((d) => {
      const av = safeUrl(d.avatar);
      return `<figure class="quote${ghost(d)}"><blockquote><p>${esc(d.quote)}</p></blockquote><figcaption>${av ? `<img src="${esc(av)}" alt="" width="40" height="40" loading="lazy">` : ''}<span><strong>${esc(d.name)}</strong>${d.role ? `<small>${esc(d.role)}</small>` : ''}</span></figcaption></figure>`;
    })
    .join('');
  return `<section class="section" id="testimonials"><div class="wrap">${head('What clients say')}<div class="quotes">${cards}</div></div></section>`;
}

function faq(site) {
  const list = items(site, 'faq');
  if (!list.length) return '';
  return `<section class="section" id="faq"><div class="wrap faq-grid">${head('Questions')}<div class="qa-list">${list
    .map((d) => `<details class="qa${ghost(d)}"><summary>${esc(d.question)}</summary><div class="qa-a"><p>${esc(d.answer)}</p></div></details>`)
    .join('')}</div></div></section>`;
}

function waLink(settings, message) {
  const num = digits(settings.contact?.whatsapp);
  if (!num) return '#contact';
  return `https://wa.me/${num}?text=${encodeURIComponent(message || settings.contact.whatsapp_message || '')}`;
}

function contact(site) {
  const s = site.settings;
  const c = s.contact;
  const socials = items(site, 'socials').filter((d) => safeUrl(d.url));
  const wa = waLink(s);
  const bookingOn = s.booking?.enabled !== false;
  const cal = safeUrl(c.calendly_url);
  return `<section class="section contact" id="contact"><div class="wrap contact-grid">
    <div>
      <h2>Have a video in mind?</h2>
      <p class="lede">Message me on WhatsApp, send an email, or book a call and tell me about the project.</p>
      <div class="contact-actions">
        ${digits(c.whatsapp) ? `<a class="btn btn-lime" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp me</a>` : ''}
        ${c.email ? `<a class="btn btn-ghost" href="mailto:${esc(c.email)}">Email me</a>` : ''}
        ${bookingOn ? `<button class="btn btn-ghost" type="button" data-book data-type="call">Book a call</button>` : cal ? `<a class="btn btn-ghost" href="${esc(cal)}" target="_blank" rel="noopener">Book a call</a>` : ''}
      </div>
    </div>
    <ul class="contact-list">
      ${c.email ? `<li><span>Email</span><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></li>` : ''}
      ${digits(c.whatsapp) ? `<li><span>WhatsApp</span><a href="${esc(wa)}" target="_blank" rel="noopener">+${esc(digits(c.whatsapp))}</a></li>` : ''}
      ${socials.map((d) => `<li><span>${esc(d.platform)}</span><a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">${esc(String(d.label || '').trim() || safeUrl(d.url).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a></li>`).join('')}
    </ul>
  </div></section>`;
}

function footer(site) {
  const s = site.settings;
  return `<footer class="foot"><div class="wrap foot-in"><span>&copy; ${new Date().getFullYear()} ${esc(s.brand.name)}</span><span>${esc(s.brand.tagline)}</span></div></footer>`;
}

function dialogs(site) {
  const s = site.settings;
  const services = items(site, 'services').map((d) => d.title).filter(Boolean);
  const cfg = {
    wa: digits(s.contact?.whatsapp),
    calendly: safeUrl(s.contact?.calendly_url),
    name: s.brand.name,
  };
  const wa = digits(s.contact?.whatsapp);
  const fab = wa
    ? `<a class="wa-fab" href="${esc(waLink(s))}" target="_blank" rel="noopener" aria-label="Message on WhatsApp">${ICON.chat}</a>`
    : '';
  const booking = s.booking?.enabled !== false
    ? `<dialog id="book" class="sheet" aria-labelledby="book-title">
  <div class="sheet-in">
    <button class="sheet-close" type="button" data-close aria-label="Close">${ICON.close}</button>
    <div id="book-form-wrap">
      <h2 id="book-title">Book a call</h2>
      <p class="sheet-intro" id="book-intro">${esc(s.booking?.intro || '')}</p>
      <form id="book-form" novalidate>
        <div class="field"><label for="b-name">Your name</label><input id="b-name" name="name" required maxlength="100" autocomplete="name"></div>
        <div class="field"><label for="b-email">Email</label><input id="b-email" name="email" type="email" required maxlength="160" autocomplete="email"></div>
        <div class="field"><label for="b-phone">WhatsApp or phone <small>(optional)</small></label><input id="b-phone" name="phone" type="tel" maxlength="30" autocomplete="tel"></div>
        <div class="field"><label for="b-service">What do you need?</label><select id="b-service" name="service"><option value="">Choose one</option>${services.map((t) => `<option>${esc(t)}</option>`).join('')}<option>Something else</option></select></div>
        <div class="row2">
          <div class="field"><label for="b-date">Preferred date</label><input id="b-date" name="preferred_date" type="date"></div>
          <div class="field"><label for="b-time">Preferred time <small>(India time)</small></label><select id="b-time" name="preferred_time"><option value="">Any time</option><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
        </div>
        <div class="field"><label for="b-msg">About your project</label><textarea id="b-msg" name="message" rows="4" maxlength="2000"></textarea></div>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <p class="form-error" id="book-error" role="alert" hidden></p>
        <button class="btn btn-lime btn-block" type="submit">Send request</button>
      </form>
    </div>
    <div id="book-done" hidden>
      <h2>Request sent</h2>
      <p id="book-done-text">Thank you. I will reply by email or WhatsApp.</p>
      <div class="done-actions"><a class="btn btn-lime" id="book-wa" href="#" target="_blank" rel="noopener" hidden>Continue on WhatsApp</a><button class="btn btn-ghost" type="button" data-close>Close</button></div>
    </div>
  </div>
</dialog>`
    : '';
  return `${fab}
<dialog id="player" class="sheet sheet-player" aria-label="Video player">
  <div class="sheet-in">
    <button class="sheet-close" type="button" data-close aria-label="Close video">${ICON.close}</button>
    <div class="stage" id="stage"></div>
    <p class="stage-cap" id="stage-cap"></p>
  </div>
</dialog>
${booking}
<script type="application/json" id="site-cfg">${jsonForScript(cfg)}</script>`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
export function renderHome(site, req) {
  const s = site.settings;
  const base = req.siteUrl;
  const sameAs = items(site, 'socials').map((d) => safeUrl(d.url)).filter(Boolean);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${base}/#person`,
        name: s.brand.owner || s.brand.name,
        ...(s.brand.owner ? { alternateName: s.brand.name } : {}),
        brand: { '@type': 'Brand', name: s.brand.name },
        jobTitle: s.brand.role,
        url: base,
        ...(s.contact?.email ? { email: s.contact.email } : {}),
        ...(sameAs.length ? { sameAs } : {}),
        image: safeUrl(s.about?.photo) || (assetUrl(s.brand.logo) ? base + assetUrl(s.brand.logo) : undefined),
      },
      { '@type': 'WebSite', '@id': `${base}/#website`, url: base, name: s.brand.name, description: s.seo.description },
    ],
  };
  const body = `${nav(site, true)}
<main id="main">
${hero(site)}
${proof(site)}
${work(site)}
${services(site)}
${about(site)}
${processSteps(site)}
${tools(site)}
${testimonials(site)}
${faq(site)}
${contact(site)}
</main>
${footer(site)}
${dialogs(site)}`;
  return layout({
    site,
    req,
    path: '/',
    title: s.seo.title,
    description: s.seo.description,
    noindex: site.source !== 'database',
    jsonld,
    body,
    bodyClass: 'home',
  });
}

export function renderProject(site, project, req) {
  const s = site.settings;
  const base = req.siteUrl;
  const v = parseVideo(project.video_url);
  const thumb = thumbOf(project);
  const aspect = v.shorts ? 'portrait' : ASPECTS[project.aspect] ? project.aspect : 'landscape';
  const desc = (project.description || `${project.title}, a ${project.category || 'video'} project by ${s.brand.name}.`).slice(0, 300);
  let player;
  if (v.kind === 'embed') {
    player = `<div class="stage stage-${aspect}"><iframe src="${esc(v.embed.replace('autoplay=1', 'autoplay=0'))}" title="${esc(project.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  } else if (v.kind === 'video') {
    player = `<div class="stage stage-${aspect}"><video src="${esc(v.url)}" controls playsinline preload="metadata"${thumb ? ` poster="${esc(thumb)}"` : ''}></video></div>`;
  } else if (v.kind === 'link') {
    player = `<div class="stage stage-${aspect} stage-link"><a class="btn btn-lime" href="${esc(v.url)}" target="_blank" rel="noopener">Watch on ${esc(v.label)}</a></div>`;
  } else {
    player = `<div class="stage stage-${aspect}"><span class="bars" aria-hidden="true"></span></div>`;
  }
  const others = site.projects.filter((p) => p.id !== project.id && !p.is_placeholder).slice(0, 3);
  const jsonld = thumb && !project.is_placeholder
    ? {
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: project.title,
        description: desc,
        thumbnailUrl: [thumb],
        uploadDate: project.created_at || new Date().toISOString(),
        ...(v.kind === 'embed' ? { embedUrl: v.embed.replace('autoplay=1', 'autoplay=0') } : {}),
        ...(v.kind === 'video' ? { contentUrl: v.url } : {}),
        author: { '@type': s.brand.owner ? 'Person' : 'Organization', name: s.brand.owner || s.brand.name },
        publisher: { '@type': 'Organization', name: s.brand.name },
      }
    : undefined;
  const body = `${nav(site, false)}
<main id="main" class="page">
  <div class="wrap">
    <p class="crumbs"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/#work">Work</a></p>
    <article class="project">
      <header><p class="clip-cat">${esc(project.category || 'Project')}${project.client ? ` for ${esc(project.client)}` : ''}</p><h1>${esc(project.title)}</h1></header>
      ${player}
      ${project.description ? `<div class="project-text">${paragraphs(project.description)}</div>` : ''}
      <div class="hero-cta">${s.booking?.enabled !== false ? `<button class="btn btn-lime" type="button" data-book data-type="call" data-service="${esc(project.category || '')}">Book a call</button>` : ''}<a class="btn btn-ghost" href="/#work">More work</a></div>
    </article>
    ${others.length ? `<section class="more"><h2>More projects</h2><ul class="grid">${others.map((p) => clip(p)).join('')}</ul></section>` : ''}
  </div>
</main>
${footer(site)}
${dialogs(site)}`;
  return layout({
    site,
    req,
    path: `/work/${project.slug}`,
    title: `${project.title} | ${s.brand.name}`,
    description: desc,
    ogImage: thumb,
    noindex: site.source !== 'database' || Boolean(project.is_placeholder),
    jsonld,
    body,
    bodyClass: 'project-page',
  });
}

export function render404(site, req) {
  const s = site.settings;
  const body = `${nav(site, false)}
<main id="main" class="page"><div class="wrap"><h1>Page not found</h1><p class="lede">That page does not exist. It may have been moved or hidden.</p><div class="hero-cta"><a class="btn btn-lime" href="/">Back to the portfolio</a></div></div></main>
${footer(site)}
${dialogs(site)}`;
  return layout({ site, req, path: '/404', title: `Page not found | ${s.brand.name}`, description: 'Page not found.', noindex: true, body, bodyClass: 'project-page' });
}
