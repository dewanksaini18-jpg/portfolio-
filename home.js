// Overview: what needs attention, and the shortcuts you use most.
import { db, config } from '../sb.js';
import { h, toast, busy } from '../ui.js';
import { COLLECTIONS } from '../schema.js';
import { loadStarter } from '../seed.js';
import { parseVideo } from '/shared/media.js';

export async function render(view, { navigate }) {
  const [projects, items, settings, fresh] = await Promise.all([
    db.list('projects', 'select=id,title,published,is_placeholder,video_url'),
    db.list('content_items', 'select=id,collection,data'),
    db.list('site_settings', 'select=key,value'),
    db.list('bookings', 'select=id&status=eq.new').catch(() => []),
  ]);
  const cfg = config();
  const get = (k) => settings.find((s) => s.key === k)?.value || {};

  const realProjects = projects.filter((p) => !p.is_placeholder && p.published);
  const placeholders = [];
  const ph = projects.filter((p) => p.is_placeholder).length;
  if (ph) placeholders.push({ label: 'Projects', n: ph, href: '#/projects' });
  for (const [key, def] of Object.entries(COLLECTIONS)) {
    const n = items.filter((i) => i.collection === key && i.data?.placeholder).length;
    if (n) placeholders.push({ label: def.label, n, href: `#/content/${key}` });
  }
  if (get('about').placeholder) placeholders.push({ label: 'About', n: 1, href: '#/site/about' });
  const totalPh = placeholders.reduce((a, b) => a + b.n, 0);

  const tasks = [];
  if (!realProjects.length) tasks.push({ text: 'Add your first video', btn: 'Add project', href: '#/projects' });
  if (!parseVideo(get('hero').showreel_url).kind) tasks.push({ text: 'Add your showreel link for the top of the homepage', btn: 'Add showreel', href: '#/site/brand' });
  if (get('about').placeholder) tasks.push({ text: 'Write your About story and add a photo', btn: 'Edit About', href: '#/site/about' });
  if (!cfg.bookingsReady) tasks.push({ text: 'Switch on booking saves (needs the service key)', btn: 'See how', href: '#/account' });

  const reload = h('button', { class: 'btn btn-quiet btn-sm', type: 'button' }, 'Add any missing starter content');
  reload.addEventListener('click', () => busy(reload, 'Adding...', async () => {
    try { const n = await loadStarter(); toast(n ? `Added ${n} starter items.` : 'Nothing was missing.'); if (n) navigate('#/'); location.reload(); } catch (e) { toast(e.message, 'error'); }
  }));

  view.append(h('div', null,
    h('div', { class: 'stats' },
      stat(realProjects.length, 'Live projects', '#/projects'),
      stat(fresh.length, 'New booking requests', '#/bookings', fresh.length > 0),
      stat(totalPh, 'Placeholders to replace', placeholders[0]?.href || '#/projects', totalPh > 0)),
    h('section', { class: 'panel' }, h('h2', null, 'Quick actions'),
      h('div', { class: 'row-actions' },
        h('a', { class: 'btn btn-primary', href: '#/projects' }, 'Add or edit projects'),
        h('a', { class: 'btn', href: '#/bookings' }, 'See booking requests'),
        h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'Open website'))),
    tasks.length ? h('section', { class: 'panel' }, h('h2', null, 'Do this next'),
      h('ul', { class: 'tasks' }, tasks.map((t) => h('li', null, h('span', null, t.text), h('a', { class: 'btn btn-sm', href: t.href }, t.btn))))) : null,
    placeholders.length ? h('section', { class: 'panel' }, h('h2', null, 'Placeholders still on your site'),
      h('p', { class: 'muted' }, 'These are marked as placeholders on the website until you edit and save them. Replace them with real content or hide them.'),
      h('ul', { class: 'tasks' }, placeholders.map((p) => h('li', null, h('span', null, `${p.label}: ${p.n}`), h('a', { class: 'btn btn-sm', href: p.href }, 'Open'))))) : null,
    h('p', { class: 'muted foot-note' }, 'Changes appear on your website within about 30 seconds. ', reload)));
}

function stat(n, label, href, hot = false) {
  return h('a', { class: `stat-card${hot ? ' hot' : ''}`, href }, h('strong', null, String(n)), h('span', null, label));
}
