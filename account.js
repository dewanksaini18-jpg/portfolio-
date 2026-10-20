// Account: who is signed in, change password, system status.
import * as sb from '../sb.js';
import { h, toast, busy } from '../ui.js';

export async function render(view) {
  const cfg = sb.config();
  const pw1 = h('input', { id: 'pw1', type: 'password', autocomplete: 'new-password', minLength: 8, required: true });
  const pw2 = h('input', { id: 'pw2', type: 'password', autocomplete: 'new-password', minLength: 8, required: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Change password');
  const form = h('form', { onsubmit: (e) => {
    e.preventDefault();
    if (pw1.value.length < 8) return toast('Use at least 8 characters.', 'error');
    if (pw1.value !== pw2.value) return toast('The two passwords do not match.', 'error');
    busy(save, 'Saving...', async () => {
      try { await sb.changePassword(pw1.value); pw1.value = ''; pw2.value = ''; toast('Password changed.'); } catch (err) { toast(err.message, 'error'); }
    });
  } },
  h('div', { class: 'field' }, h('label', { for: 'pw1' }, 'New password'), pw1, h('p', { class: 'hint' }, 'At least 8 characters.')),
  h('div', { class: 'field' }, h('label', { for: 'pw2' }, 'Repeat new password'), pw2),
  save);

  const status = (ok, text, fix) => h('li', { class: ok ? 'ok' : 'bad' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', null, text, !ok && fix ? h('small', null, fix) : null));

  view.append(
    h('section', { class: 'panel' }, h('h2', null, 'Signed in'), h('p', null, sb.user()?.email || ''),
      h('div', { class: 'row-actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => { await sb.signOut(); location.reload(); } }, 'Sign out'))),
    h('section', { class: 'panel' }, h('h2', null, 'Change password'), form),
    h('section', { class: 'panel' }, h('h2', null, 'System status'),
      h('ul', { class: 'status-list' },
        status(cfg.configured, 'Database connected'),
        status(cfg.bookingsReady, 'Booking requests can be saved', 'Add SUPABASE_SERVICE_ROLE_KEY and redeploy (see docs/DEPLOY.md).'))));
}
