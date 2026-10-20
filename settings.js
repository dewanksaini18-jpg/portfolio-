// Site settings: brand, hero, about, contact, booking, SEO and accent colour.
import { db } from '../sb.js';
import { h, toast, buildFields, busy } from '../ui.js';
import { SETTINGS_GROUPS } from '../schema.js';
import { DEFAULT_SETTINGS } from '/shared/defaults.js';

const INTROS = {
  brand: 'The name, tagline and showreel at the top of your homepage.',
  about: 'Your story and photo.',
  contact: 'How people reach you, and what the booking form says.',
  seo: 'Colours, and how your site looks in Google and when shared.',
};

export async function render(view, { param }) {
  const group = SETTINGS_GROUPS[param];
  if (!group) {
    view.append(h('div', { class: 'panel' }, h('h2', null, 'Unknown section'), h('a', { class: 'btn', href: '#/' }, 'Back to overview')));
    return;
  }
  const rows = await db.list('site_settings', 'select=key,value');
  const current = {};
  for (const r of rows) current[r.key] = r.value || {};

  const blocks = group.sections.map((sec) => ({
    sec,
    form: buildFields(sec.fields, { ...(DEFAULT_SETTINGS[sec.key] || {}), ...(current[sec.key] || {}) }),
  }));

  const save = h('button', { class: 'btn btn-primary', type: 'button' }, 'Save changes');
  save.addEventListener('click', () => busy(save, 'Saving...', async () => {
    for (const b of blocks) {
      const problem = b.form.validate();
      if (problem) return toast(problem, 'error');
    }
    const payload = blocks.map(({ sec, form }) => {
      const value = { ...(DEFAULT_SETTINGS[sec.key] || {}), ...(current[sec.key] || {}), ...form.read() };
      if (sec.key === 'contact') value.whatsapp = String(value.whatsapp || '').replace(/\D/g, '');
      if (sec.key === 'about') value.placeholder = false;
      return { key: sec.key, value };
    });
    const wa = payload.find((p) => p.key === 'contact')?.value.whatsapp;
    if (wa !== undefined && wa !== '' && (wa.length < 8 || wa.length > 15)) return toast('The WhatsApp number should have 8 to 15 digits, including the country code.', 'error');
    try {
      await db.upsert('site_settings', payload, 'key');
      for (const p of payload) current[p.key] = p.value;
      toast('Saved. The website updates within about 30 seconds.');
    } catch (e) { toast(e.message, 'error'); }
  }));

  // h() flattens arrays and skips empty values; the native append() would print them as text.
  view.append(h('div', null,
    h('p', { class: 'muted lead' }, INTROS[param] || ''),
    blocks.map(({ sec, form }) => h('section', { class: 'panel' }, h('h2', null, sec.title), form.el)),
    h('div', { class: 'row-actions end sticky-actions' }, h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener' }, 'Open website'), save)));
}
