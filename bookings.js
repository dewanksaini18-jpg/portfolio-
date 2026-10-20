// Bookings: every "Book a call" request, with status, private notes and quick replies.
import { db, config } from '../sb.js';
import { h, toast, confirmBox, fmtDate } from '../ui.js';

const STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];
const label = (s) => s[0].toUpperCase() + s.slice(1);

export async function render(view) {
  let rows = await db.list('bookings', 'select=*&order=created_at.desc');
  let filter = 'all';
  const cfg = config();

  const counts = () => {
    const c = { all: rows.length };
    for (const s of STATUSES) c[s] = rows.filter((r) => r.status === s).length;
    return c;
  };

  const host = h('div');

  function card(b) {
    const phoneDigits = String(b.phone || '').replace(/\D/g, '');
    const facts = [
      ['Email', h('a', { href: `mailto:${b.email}` }, b.email)],
      b.phone && ['Phone', h('a', { href: `tel:${b.phone}` }, b.phone)],
      b.service && ['Service', b.service],
      (b.preferred_date || b.preferred_time) && ['Preferred', [b.preferred_date, b.preferred_time].filter(Boolean).join(', ')],
      b.source_page && ['From page', b.source_page],
    ].filter(Boolean);

    const status = h('select', { 'aria-label': `Status for ${b.name}`, onchange: async () => {
      try { const [s] = await db.update('bookings', b.id, { status: status.value }); Object.assign(b, s); draw(); } catch (e) { toast(e.message, 'error'); }
    } }, STATUSES.map((s) => h('option', { value: s, selected: s === b.status }, label(s))));
    const notes = h('textarea', { rows: 2, placeholder: 'Private notes (only you see these)', 'aria-label': `Notes for ${b.name}`, value: b.notes || '', maxLength: 1000 });
    notes.addEventListener('blur', async () => {
      if (notes.value === (b.notes || '')) return;
      try { const [s] = await db.update('bookings', b.id, { notes: notes.value }); Object.assign(b, s); toast('Note saved.'); } catch (e) { toast(e.message, 'error'); }
    });

    return h('article', { class: `booking st-${b.status}` },
      h('header', null,
        h('div', null, h('strong', null, b.name), b.status === 'new' && h('span', { class: 'badge badge-lime' }, 'New')),
        h('time', { class: 'meta', datetime: b.created_at }, fmtDate(b.created_at))),
      h('dl', { class: 'facts' }, facts.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
      b.message && h('p', { class: 'msg' }, b.message),
      h('div', { class: 'booking-ctl' },
        h('label', null, h('span', null, 'Status'), status),
        h('label', { class: 'grow' }, h('span', null, 'Notes'), notes)),
      h('div', { class: 'row-actions' },
        phoneDigits.length >= 8 && h('a', { class: 'btn btn-sm', href: `https://wa.me/${phoneDigits}`, target: '_blank', rel: 'noopener' }, 'Reply on WhatsApp'),
        h('a', { class: 'btn btn-sm', href: `mailto:${b.email}?subject=${encodeURIComponent('Your video project')}` }, 'Reply by email'),
        h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: async () => {
          if (!(await confirmBox(`Delete the request from ${b.name}? This cannot be undone.`))) return;
          try { await db.remove('bookings', b.id); rows = rows.filter((x) => x.id !== b.id); draw(); toast('Deleted.'); } catch (e) { toast(e.message, 'error'); }
        } }, 'Delete')));
  }

  function draw() {
    const c = counts();
    const shown = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    host.replaceChildren(h('div', null,
      !cfg.bookingsReady && h('div', { class: 'panel warn' },
        h('h2', null, 'Booking saves are not switched on yet'),
        h('p', { class: 'muted' }, 'Add SUPABASE_SERVICE_ROLE_KEY to your environment variables and redeploy. Until then the website cannot save new requests.')),
      h('div', { class: 'toolbar' },
        h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by status' },
          ['all', ...STATUSES].map((s) => h('button', { class: `chip${filter === s ? ' on' : ''}`, type: 'button', 'aria-pressed': String(filter === s), onclick: () => { filter = s; draw(); } }, `${label(s)} ${c[s]}`)))),
      h('p', { class: 'muted' }, 'Each request is saved here the moment someone sends it from your website. Mark it as contacted, confirmed or completed as you go.'),
      shown.length
        ? h('div', { class: 'booking-list' }, shown.map(card))
        : h('div', { class: 'empty' }, h('h2', null, rows.length ? 'Nothing with this status' : 'No requests yet'), h('p', { class: 'muted' }, rows.length ? 'Try another filter.' : 'When someone books a call on your website, it shows up here.'))));
  }

  draw();
  view.append(host);
}
