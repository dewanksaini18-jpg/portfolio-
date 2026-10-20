// Generic editor for every list on the site: services, testimonials, FAQ, process, tools, clients, numbers, social links.
import { db } from '../sb.js';
import { h, toast, modal, confirmBox, buildFields, busy } from '../ui.js';
import { COLLECTIONS } from '../schema.js';
import { persistOrder, moveRow } from '../lists.js';

export async function render(view, { param }) {
  const def = COLLECTIONS[param];
  if (!def) {
    view.append(h('div', { class: 'panel' }, h('h2', null, 'Unknown section'), h('a', { class: 'btn', href: '#/' }, 'Back to overview')));
    return;
  }
  let list = await db.list('content_items', `select=*&collection=eq.${encodeURIComponent(param)}&order=position.asc,created_at.asc`);

  const clip = (t, n = 90) => (String(t || '').length > n ? `${String(t).slice(0, n)}...` : String(t || ''));

  function row(item, i) {
    const d = item.data || {};
    return h('li', { class: `row${item.published ? '' : ' is-off'}` },
      h('div', { class: 'row-main' },
        h('strong', null, clip(def.title(d), 70) || '(untitled)'),
        def.sub(d) ? h('span', { class: 'meta' }, clip(def.sub(d))) : null,
        h('span', { class: 'badges' },
          d.highlight && h('span', { class: 'badge badge-lime' }, 'Highlighted'),
          !item.published && h('span', { class: 'badge' }, 'Hidden'),
          d.placeholder && h('span', { class: 'badge badge-warn' }, 'Placeholder'))),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Move down', disabled: i === list.length - 1, onclick: () => move(i, 1) }, '↓'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => toggle(item) }, item.published ? 'Hide' : 'Show'),
        h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => edit(item) }, 'Edit'),
        h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => remove(item) }, 'Delete')));
  }

  const host = h('div');
  function draw() {
    host.replaceChildren(
      h('div', { class: 'toolbar' },
        h('p', { class: 'muted' }, def.help),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => edit(null) }, `Add ${def.one}`)),
      list.length
        ? h('ul', { class: 'rows' }, list.map(row))
        : h('div', { class: 'empty' }, h('h2', null, `No ${def.label.toLowerCase()} yet`), h('p', { class: 'muted' }, 'This section stays hidden on the website until you add something.'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => edit(null) }, `Add ${def.one}`)));
  }

  async function move(i, dir) {
    if (!moveRow(list, i, dir)) return;
    draw();
    try { await persistOrder('content_items', list); toast('Order saved.'); } catch (e) { toast(e.message, 'error'); }
  }

  async function toggle(item) {
    try {
      const [saved] = await db.update('content_items', item.id, { published: !item.published });
      Object.assign(item, saved);
      draw();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function remove(item) {
    if (!(await confirmBox(`Delete "${clip(def.title(item.data || {}), 60)}"? It disappears from your website.`))) return;
    try {
      await db.remove('content_items', item.id);
      list = list.filter((x) => x.id !== item.id);
      draw();
      toast('Deleted.');
    } catch (e) { toast(e.message, 'error'); }
  }

  function edit(item) {
    const isNew = !item;
    const m = modal(isNew ? `Add ${def.one}` : `Edit ${def.one}`);
    const form = buildFields(def.fields, item?.data || {});
    const visible = buildFields([{ k: 'published', label: 'Visible on the website', type: 'check' }], { published: item ? item.published : true });
    const save = h('button', { class: 'btn btn-primary', type: 'button' }, isNew ? `Add ${def.one}` : 'Save changes');
    save.addEventListener('click', () => busy(save, 'Saving...', async () => {
      const problem = form.validate();
      if (problem) return toast(problem, 'error');
      const data = { ...(item?.data || {}), ...form.read(), placeholder: false };
      const published = visible.read().published;
      try {
        if (isNew) {
          const position = list.length ? Math.max(...list.map((x) => x.position)) + 1 : 0;
          const [saved] = await db.insert('content_items', { collection: param, position, data, published });
          list.push(saved);
        } else {
          const [saved] = await db.update('content_items', item.id, { data, published });
          Object.assign(item, saved);
        }
        m.close();
        draw();
        toast('Saved. The website updates within about 30 seconds.');
      } catch (e) { toast(e.message, 'error'); }
    }));
    m.body.append(form.el, visible.el, h('div', { class: 'row-actions end sticky-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Cancel'), save));
    form.el.querySelector('input, textarea, select')?.focus();
  }

  draw();
  view.append(host);
}
