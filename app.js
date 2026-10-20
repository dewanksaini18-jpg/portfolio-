// Dashboard shell: sign-in, access check, navigation and routing.
import * as sb from './sb.js';
import { h, toast } from './ui.js';
import { COLLECTIONS, SETTINGS_GROUPS } from './schema.js';
import { seedIfNeeded } from './seed.js';

const app = document.getElementById('app');

const NAV = [
  { group: 'Portfolio', items: [
    { id: 'projects', label: 'Projects', href: '#/projects' },
    { id: 'bookings', label: 'Bookings', href: '#/bookings' },
  ] },
  { group: 'Website content', items: Object.entries(COLLECTIONS).map(([k, c]) => ({ id: `content/${k}`, label: c.label, href: `#/content/${k}` })) },
  { group: 'Site settings', items: Object.entries(SETTINGS_GROUPS).map(([k, g]) => ({ id: `site/${k}`, label: g.label, href: `#/site/${k}` })) },
  { group: 'Account', items: [{ id: 'account', label: 'Account', href: '#/account' }] },
];

// ---------------------------------------------------------------- screens
function card(title, ...body) {
  return h('main', { class: 'gate' }, h('div', { class: 'gate-card' }, h('p', { class: 'gate-brand' }, h('img', { src: '/assets/wolf-edit-logo.webp', alt: 'WOLF EDIT', width: 110, height: 34 })), h('h1', null, title), ...body));
}
const mount = (node) => { app.replaceChildren(node); };

function screenFatal(title, message, extra) {
  mount(card(title, h('p', { class: 'muted' }, message), extra, h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Try again')));
}

function screenSetup() {
  mount(card('Connect Supabase first',
    h('p', { class: 'muted' }, 'The dashboard is installed, but the website has no database connection yet.'),
    h('ol', { class: 'steps-list' },
      h('li', null, 'Create a free project at supabase.com.'),
      h('li', null, 'Add SUPABASE_URL and SUPABASE_ANON_KEY to your environment variables (Vercel: Settings, Environment Variables).'),
      h('li', null, 'Redeploy, then reload this page.')),
    h('p', { class: 'muted' }, 'Full steps are in docs/DEPLOY.md.')));
}

function screenNoDatabase() {
  mount(card('Run the database setup',
    h('p', { class: 'muted' }, 'Supabase is connected, but the portfolio tables are missing.'),
    h('p', { class: 'muted' }, 'Open Supabase, go to SQL Editor, paste the contents of supabase/schema.sql and press Run. Then reload this page.'),
    h('button', { class: 'btn btn-primary', type: 'button', onclick: () => location.reload() }, 'Reload')));
}

function screenNotAdmin() {
  const email = sb.user()?.email || 'your email';
  const sql = `insert into public.admins (user_id)\nselect id from auth.users where email = '${email}'\non conflict do nothing;`;
  mount(card('This account is not an admin yet',
    h('p', { class: 'muted' }, `You are signed in as ${email}, but only admins can edit the site.`),
    h('p', { class: 'muted' }, 'In Supabase, open SQL Editor, run the line below, then sign in again.'),
    h('pre', { class: 'code' }, sql),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn', type: 'button', onclick: () => navigator.clipboard?.writeText(sql).then(() => toast('Copied.')) }, 'Copy SQL'),
      h('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await sb.signOut(); location.reload(); } }, 'Sign out'))));
}

function screenLogin(message = '') {
  const email = h('input', { id: 'li-email', type: 'email', required: true, autocomplete: 'username', placeholder: 'you@example.com' });
  const pass = h('input', { id: 'li-pass', type: 'password', required: true, autocomplete: 'current-password', minLength: 6 });
  const error = h('p', { class: 'form-error', role: 'alert', hidden: !message }, message);
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'login', onsubmit: async (e) => {
    e.preventDefault();
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'Signing in...';
    try {
      await sb.signIn(email.value.trim(), pass.value);
      await boot();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Sign in';
      pass.focus();
    }
  } },
  h('div', { class: 'field' }, h('label', { for: 'li-email' }, 'Email'), email),
  h('div', { class: 'field' }, h('label', { for: 'li-pass' }, 'Password'), pass),
  error, submit,
  h('button', { class: 'link-btn', type: 'button', onclick: async () => {
    if (!email.value.trim()) { error.textContent = 'Type your email above, then press this again.'; error.hidden = false; email.focus(); return; }
    try { await sb.sendReset(email.value.trim()); toast('If that email has an account, a reset link is on its way.'); } catch (err) { toast(err.message, 'error'); }
  } }, 'Forgot your password?'));
  mount(card('Sign in', h('p', { class: 'muted' }, 'Manage your portfolio, projects and bookings.'), form));
  email.focus();
}

// ---------------------------------------------------------------- shell + routing
const ROUTES = {
  '': () => import('./views/home.js'),
  projects: () => import('./views/projects.js'),
  bookings: () => import('./views/bookings.js'),
  content: () => import('./views/content.js'),
  site: () => import('./views/settings.js'),
  account: () => import('./views/account.js'),
};

function titleFor(route, param) {
  if (route === '') return 'Overview';
  if (route === 'projects') return 'Projects';
  if (route === 'bookings') return 'Bookings';
  if (route === 'content') return COLLECTIONS[param]?.label || 'Content';
  if (route === 'site') return SETTINGS_GROUPS[param]?.label || 'Settings';
  return 'Account';
}

function mountShell() {
  const side = h('aside', { class: 'side', id: 'side', 'aria-label': 'Dashboard menu' },
    h('a', { class: 'side-brand', href: '#/', 'aria-label': 'WOLF EDIT dashboard' }, h('img', { src: '/assets/wolf-edit-logo.webp', alt: 'WOLF EDIT', width: 110, height: 34 }), h('small', null, 'Dashboard')),
    h('nav', null,
      h('a', { class: 'nav-item', href: '#/', 'data-id': '' }, 'Overview'),
      NAV.map((g) => h('div', { class: 'nav-group' }, h('p', { class: 'nav-title' }, g.group), g.items.map((i) => h('a', { class: 'nav-item', href: i.href, 'data-id': i.id }, i.label))))),
    h('div', { class: 'side-foot' },
      h('a', { class: 'btn btn-sm', href: '/', target: '_blank', rel: 'noopener' }, 'Open website'),
      h('button', { class: 'btn btn-sm btn-quiet', type: 'button', onclick: async () => { await sb.signOut(); location.reload(); } }, 'Sign out')));
  const scrim = h('div', { class: 'scrim', onclick: () => setDrawer(false) });
  const title = h('h1', { id: 'page-title' }, 'Overview');
  const view = h('main', { id: 'view', class: 'view', tabindex: '-1' });
  const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Open menu', 'aria-controls': 'side', 'aria-expanded': 'false', onclick: () => setDrawer(true) }, '☰');
  const top = h('header', { class: 'top' }, menuBtn, title, h('a', { class: 'btn btn-sm top-site', href: '/', target: '_blank', rel: 'noopener' }, 'Open website'));
  const tab = (href, label, id) => h('a', { class: 'tab', href, 'data-id': id }, label);
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Quick links' },
    tab('#/', 'Home', ''), tab('#/projects', 'Projects', 'projects'), tab('#/bookings', 'Bookings', 'bookings'),
    h('button', { class: 'tab', type: 'button', onclick: () => setDrawer(true) }, 'Menu'));

  function setDrawer(open) {
    side.classList.toggle('open', open);
    scrim.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  }

  mount(h('div', { class: 'shell' }, side, scrim, h('div', { class: 'main' }, top, view), tabbar));
  return { view, title, setDrawer };
}

let shell = null;
let token = 0;

async function route() {
  if (!shell) return;
  const raw = location.hash.replace(/^#\/?/, '');
  const [r = '', param = ''] = raw.split('/');
  const page = ROUTES[r] !== undefined ? r : '';
  const id = [page, param].filter(Boolean).join('/');
  shell.setDrawer(false);
  document.querySelectorAll('[data-id]').forEach((a) => {
    const on = a.dataset.id === id || (a.dataset.id === page && a.classList.contains('tab'));
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const name = titleFor(page, param);
  shell.title.textContent = name;
  document.title = `${name} | Dashboard`;
  const mine = ++token;
  shell.view.replaceChildren(h('p', { class: 'muted pad' }, 'Loading...'));
  try {
    const mod = await ROUTES[page]();
    const next = h('div', { class: 'view-in' });
    await mod.render(next, { param, setTitle: (t) => { shell.title.textContent = t; }, navigate: (hash) => { location.hash = hash; } });
    if (mine !== token) return;
    shell.view.replaceChildren(next);
    window.scrollTo(0, 0);
  } catch (err) {
    if (mine !== token) return;
    if (err.auth) { await sb.signOut(); return boot('Your session expired. Please sign in again.'); }
    shell.view.replaceChildren(
      h('div', { class: 'panel' }, h('h2', null, 'Something went wrong'), h('p', { class: 'muted' }, err.message || 'Unknown error'),
        h('button', { class: 'btn', type: 'button', onclick: route }, 'Try again')));
  }
}

async function boot(message = '') {
  let cfg;
  try { cfg = await sb.init(); } catch { return screenFatal('Cannot reach the server', 'The dashboard could not load its settings. Check your connection.'); }
  if (!cfg.configured) return screenSetup();
  if (!sb.signedIn()) return screenLogin(message);
  try {
    const rows = await sb.db.list('admins', 'select=user_id');
    if (!rows.length) return screenNotAdmin();
  } catch (err) {
    if (err.auth) return screenLogin(err.message);
    if (/admins|relation|schema cache|does not exist/i.test(err.message) || err.status === 404) return screenNoDatabase();
    if (err.status === 401 || err.status === 403) { await sb.signOut(); return screenLogin('Please sign in again.'); }
    return screenFatal('Could not load your account', err.message);
  }
  try {
    if (await seedIfNeeded()) toast('Starter content added. Replace the placeholders with your own.');
  } catch (err) {
    toast(`Could not add starter content: ${err.message}`, 'error');
  }
  shell = mountShell();
  await route();
}

addEventListener('hashchange', route);
boot();
