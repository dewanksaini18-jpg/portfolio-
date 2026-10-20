// Projects: add, edit, delete, reorder, feature on the homepage, hide.
import { db, upload, removeUploaded, uploadLimitMb } from '../sb.js';
import { h, toast, modal, confirmBox, buildFields, busy } from '../ui.js';
import { parseVideo, slugify, ASPECTS } from '/shared/media.js';
import { CATEGORY_SUGGESTIONS } from '../schema.js';
import { persistOrder, moveRow } from '../lists.js';

const aspectLabel = (a) => ASPECTS[a]?.label || 'Landscape 16:9';

export async function render(view) {
  let list = await db.list('projects', 'select=*&order=position.asc,created_at.desc');

  const thumbOf = (p) => p.thumbnail_url || parseVideo(p.video_url).thumb;

  function row(p, i) {
    const v = parseVideo(p.video_url);
    const thumb = thumbOf(p);
    const meta = [p.category || 'No category', aspectLabel(p.aspect).split(' ')[0], v.label || 'No video yet'].join('  ·  ');
    return h('li', { class: `row${p.published ? '' : ' is-off'}` },
      h('div', { class: 'thumb' }, thumb ? h('img', { src: thumb, alt: '', loading: 'lazy', onerror: (e) => e.target.remove() }) : h('span', { class: 'bars' })),
      h('div', { class: 'row-main' },
        h('strong', null, p.title),
        h('span', { class: 'meta' }, meta),
        h('span', { class: 'badges' },
          p.featured && h('span', { class: 'badge badge-lime' }, 'Featured'),
          !p.published && h('span', { class: 'badge' }, 'Hidden'),
          p.is_placeholder && h('span', { class: 'badge badge-warn' }, 'Placeholder'))),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': `Move ${p.title} up`, disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
        h('button', { class: 'btn btn-sm', type: 'button', 'aria-label': `Move ${p.title} down`, disabled: i === list.length - 1, onclick: () => move(i, 1) }, '↓'),
        h('button', { class: 'btn btn-sm', type: 'button', disabled: i === 0, onclick: () => move(i, 'top') }, 'To top'),
        h('button', { class: `btn btn-sm${p.featured ? ' btn-on' : ''}`, type: 'button', 'aria-pressed': String(p.featured), onclick: () => patch(p, { featured: !p.featured }) }, p.featured ? 'Featured' : 'Feature'),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: () => patch(p, { published: !p.published }) }, p.published ? 'Hide' : 'Show'),
        h('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => edit(p) }, 'Edit'),
        h('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => remove(p) }, 'Delete')));
  }

  const host = h('div');
  function draw() {
    const featured = list.filter((p) => p.featured && p.published).length;
    host.replaceChildren(
      h('div', { class: 'toolbar' },
        h('p', { class: 'muted' }, `${list.length} project${list.length === 1 ? '' : 's'}. Featured projects appear first in the homepage carousel, in the order shown here (${featured} featured now).`),
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => edit(null) }, 'Add project')),
      list.length
        ? h('ul', { class: 'rows' }, list.map(row))
        : h('div', { class: 'empty' }, h('h2', null, 'No projects yet'), h('p', { class: 'muted' }, 'Add your first video: paste a YouTube, Instagram or Google Drive link, or upload a file.'), h('button', { class: 'btn btn-primary', type: 'button', onclick: () => edit(null) }, 'Add your first project')));
  }

  async function move(i, dir) {
    if (!moveRow(list, i, dir)) return;
    draw();
    try { await persistOrder('projects', list); toast('Order saved.'); } catch (e) { toast(e.message, 'error'); }
  }

  async function patch(p, change) {
    try {
      const [saved] = await db.update('projects', p.id, change);
      Object.assign(p, saved);
      draw();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function remove(p) {
    if (!(await confirmBox(`Delete "${p.title}"? It disappears from your website. Files you uploaded for it are deleted too.`))) return;
    try {
      await db.remove('projects', p.id);
      await Promise.all([removeUploaded(p.video_url), removeUploaded(p.thumbnail_url)]);
      list = list.filter((x) => x.id !== p.id);
      draw();
      toast('Project deleted.');
    } catch (e) { toast(e.message, 'error'); }
  }

  function uniqueSlug(base, ownId) {
    const taken = new Set(list.filter((p) => p.id !== ownId).map((p) => p.slug));
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  function edit(p) {
    const isNew = !p;
    const cur = p || { title: '', description: '', category: '', client: '', video_url: '', thumbnail_url: '', aspect: 'landscape', featured: false, published: true };
    const m = modal(isNew ? 'Add project' : 'Edit project', { wide: true });

    // ---- video block (link or upload)
    const link = h('input', { id: 'pv-link', type: 'url', placeholder: 'https://youtube.com/watch?v=...  or an Instagram or Google Drive link', value: cur.video_url || '', autocomplete: 'off' });
    const detect = h('p', { class: 'hint', 'aria-live': 'polite' });
    const bar = h('progress', { max: 100, value: 0, hidden: true });
    const fileIn = h('input', { type: 'file', accept: 'video/mp4,video/quicktime,video/webm', hidden: true });
    const pick = h('button', { class: 'btn btn-sm', type: 'button', onclick: () => fileIn.click() }, 'Upload a video file');
    const videoBlock = h('div', { class: 'field' },
      h('label', { for: 'pv-link' }, 'Video'),
      link, detect,
      h('div', { class: 'row-actions' }, pick, bar, h('span', { class: 'hint' }, `or upload up to ${uploadLimitMb} MB (MP4, MOV, WebM). For longer videos use a YouTube or Drive link.`)),
      fileIn);

    // ---- other fields
    const form = buildFields([
      { k: 'title', label: 'Title', type: 'text', required: true, max: 120 },
      { k: 'thumbnail_url', label: 'Thumbnail', type: 'image', folder: 'thumbnails', hint: 'YouTube and Google Drive thumbnails are added automatically. Instagram and Vimeo need one.' },
      { k: 'category', label: 'Category', type: 'text', datalist: CATEGORY_SUGGESTIONS, hint: 'Visitors can filter by category.' },
      { k: 'aspect', label: 'Shape', type: 'select', options: Object.entries(ASPECTS).map(([value, a]) => ({ value, label: a.label })) },
      { k: 'client', label: 'Client (optional)', type: 'text' },
      { k: 'description', label: 'Description', type: 'textarea', rows: 4, max: 1500, hint: 'Shown on the project page. Say what you did on this edit.' },
      { k: 'featured', label: 'Feature on the homepage carousel', type: 'check' },
      { k: 'published', label: 'Visible on the website', type: 'check' },
    ], cur);
    form.el.children[0].after(videoBlock);

    const shape = form.el.querySelector('[data-k="aspect"] select');
    let shapeTouched = !isNew;
    shape.addEventListener('change', () => { shapeTouched = true; });

    function runDetect() {
      const v = parseVideo(link.value);
      if (!link.value.trim()) { detect.textContent = ''; return v; }
      if (!v.kind) detect.textContent = 'That does not look like a video link. Paste the full address.';
      else if (v.source === 'youtube') detect.textContent = `YouTube ${v.shorts ? 'Short' : 'video'} found. The thumbnail is added automatically.`;
      else if (v.source === 'drive') detect.textContent = 'Google Drive video found. Make sure sharing is set to "Anyone with the link".';
      else if (v.source === 'instagram') detect.textContent = 'Instagram post found. Add a thumbnail below so the card has a picture.';
      else if (v.source === 'vimeo') detect.textContent = 'Vimeo video found. Add a thumbnail below so the card has a picture.';
      else if (v.source === 'upload') detect.textContent = 'Video file found.';
      else detect.textContent = `Link to ${v.label}. It will open in a new tab.`;
      if (!shapeTouched && (v.shorts || (v.source === 'instagram' && /\/reels?\//.test(link.value)))) shape.value = 'portrait';
      return v;
    }
    link.addEventListener('input', runDetect);
    runDetect();

    fileIn.addEventListener('change', async () => {
      const f = fileIn.files[0];
      if (!f) return;
      pick.disabled = true;
      bar.hidden = false;
      bar.value = 0;
      try {
        link.value = await upload(f, { folder: 'videos', onProgress: (n) => { bar.value = n; } });
        runDetect();
        toast('Video uploaded.');
      } catch (e) { toast(e.message, 'error'); } finally {
        pick.disabled = false;
        bar.hidden = true;
        fileIn.value = '';
      }
    });

    const save = h('button', { class: 'btn btn-primary', type: 'button' }, isNew ? 'Add project' : 'Save changes');
    save.addEventListener('click', () => busy(save, 'Saving...', async () => {
      const problem = form.validate();
      if (problem) return toast(problem, 'error');
      const url = link.value.trim();
      if (url && !parseVideo(url).kind) { link.focus(); return toast('That video link is not valid. Paste the full address, starting with https://', 'error'); }
      const d = form.read();
      const row = {
        title: d.title, description: d.description, category: d.category, client: d.client, aspect: d.aspect,
        featured: d.featured, published: d.published, thumbnail_url: d.thumbnail_url, video_url: url, is_placeholder: false,
      };
      try {
        if (isNew) {
          row.slug = uniqueSlug(slugify(d.title));
          row.position = list.length ? Math.min(...list.map((x) => x.position)) - 1 : 0;
          const [saved] = await db.insert('projects', row);
          list.unshift(saved);
        } else {
          const [saved] = await db.update('projects', p.id, row);
          Object.assign(p, saved);
        }
        m.close();
        draw();
        toast(isNew ? 'Project added. It shows on your website within about 30 seconds.' : 'Saved. The website updates within about 30 seconds.');
      } catch (e) { toast(e.message, 'error'); }
    }));

    m.body.append(form.el, h('div', { class: 'row-actions end sticky-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => m.close() }, 'Cancel'), save));
    form.el.querySelector('input')?.focus();
  }

  draw();
  view.append(host);
}
