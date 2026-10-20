/* WOLF EDIT - public site behaviour. Plain JS, no libraries (about 6 KB). */
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const body = document.body;
  let cfg = {};
  try { cfg = JSON.parse($('#site-cfg')?.textContent || '{}'); } catch { /* ignore */ }

  /* ---------- Mobile menu ---------- */
  const burger = $('.burger');
  const setMenu = (open) => {
    body.classList.toggle('nav-open', open);
    burger?.setAttribute('aria-expanded', String(open));
    burger?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger?.addEventListener('click', () => setMenu(!body.classList.contains('nav-open')));
  $$('.nav-links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Playhead + timecode ---------- */
  const tc = $('#tc');
  const FPS = 24;
  const TOTAL_SECONDS = 150; // the page "runs" 2:30; purely decorative
  const pad = (n) => String(n).padStart(2, '0');
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    document.documentElement.style.setProperty('--p', p.toFixed(4));
    if (tc) {
      const frames = Math.round(p * TOTAL_SECONDS * FPS);
      const f = frames % FPS;
      const s = Math.floor(frames / FPS) % 60;
      const m = Math.floor(frames / FPS / 60) % 60;
      tc.textContent = `00:${pad(m)}:${pad(s)}:${pad(f)}`;
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update);
  update();

  /* ---------- Current section in the menu ---------- */
  const links = $$('.nav-links a[href*="#"]');
  if (links.length && 'IntersectionObserver' in window) {
    const map = new Map(links.map((a) => [a.getAttribute('href').split('#')[1], a]));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.remove('is-current'));
        map.get(e.target.id)?.classList.add('is-current');
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- Carousel ---------- */
  const track = $('.reel-track');
  if (track) {
    const prev = $('[data-reel-prev]');
    const next = $('[data-reel-next]');
    const step = () => Math.max(240, track.clientWidth * 0.8);
    const sync = () => {
      if (!prev || !next) return;
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    };
    prev?.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step() / 2, behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step() / 2, behavior: 'smooth' }); }
    });
    sync();
  }

  /* ---------- Category filter ---------- */
  const chips = $$('.chip[data-filter]');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.toggle('is-on', c === chip));
    const f = chip.dataset.filter;
    $$('.grid .clip').forEach((clip) => { clip.hidden = f !== '*' && clip.dataset.cat !== f; });
  }));

  /* ---------- Thumbnails that fail to load fall back to colour bars ---------- */
  $$('img[data-thumb]').forEach((img) => {
    const fail = () => {
      const bars = document.createElement('span');
      bars.className = 'bars';
      bars.setAttribute('aria-hidden', 'true');
      img.replaceWith(bars);
    };
    if (img.complete && img.naturalWidth === 0) fail();
    else img.addEventListener('error', fail, { once: true });
  });

  /* ---------- Dialog helpers ---------- */
  const openDialog = (dlg) => {
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  };
  const closeDialog = (dlg) => { if (dlg?.open) dlg.close(); };
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  /* ---------- Video player ---------- */
  const player = $('#player');
  const stage = $('#stage');
  const cap = $('#stage-cap');
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-play]');
    if (!btn || !player || !stage) return;
    let d;
    try { d = JSON.parse(btn.dataset.play); } catch { return; }
    stage.innerHTML = '';
    stage.className = `stage stage-${d.aspect || 'landscape'}`;
    player.classList.toggle('is-portrait', d.aspect === 'portrait');
    if (d.k === 'video') {
      const v = document.createElement('video');
      v.src = d.src; v.controls = true; v.autoplay = true; v.playsInline = true;
      stage.append(v);
    } else {
      const f = document.createElement('iframe');
      f.src = d.src; f.title = d.title || 'Video';
      f.allow = 'autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      stage.append(f);
    }
    cap.innerHTML = `<span><strong>${escapeHtml(d.title || '')}</strong>${d.cat ? ` &middot; ${escapeHtml(d.cat)}` : ''}</span>${d.page ? `<a href="${escapeHtml(d.page)}">Open project page</a>` : ''}`;
    openDialog(player);
  });
  player?.addEventListener('close', () => { stage.innerHTML = ''; });

  /* ---------- Booking dialog ---------- */
  const dlg = $('#book');
  const form = $('#book-form');
  if (dlg && form) {
    const err = $('#book-error');
    const wrap = $('#book-form-wrap');
    const done = $('#book-done');
    const submit = $('button[type="submit"]', form);
    const date = $('#b-date');
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (date) date.min = today;

    const openBooking = (opts = {}) => {
      form.reset();
      if (opts.service) {
        const opt = [...form.service.options].find((o) => o.text.toLowerCase() === opts.service.toLowerCase());
        if (opt) form.service.value = opt.value;
      }
      err.hidden = true;
      wrap.hidden = false;
      done.hidden = true;
      submit.disabled = false;
      submit.textContent = 'Send request';
      openDialog(dlg);
    };

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-book]');
      if (!t) return;
      e.preventDefault();
      setMenu(false);
      openBooking({ service: t.dataset.service });
    });

    const showError = (msg, field) => {
      err.textContent = msg;
      err.hidden = false;
      $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
      const el = field && form.elements[field];
      if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.hidden = true;
      const data = Object.fromEntries(new FormData(form).entries());
      if (String(data.name || '').trim().length < 2) return showError('Please enter your name.', 'name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email || '').trim())) return showError('Please enter a valid email address.', 'email');
      data.source_page = location.pathname;
      submit.disabled = true;
      const label = submit.textContent;
      submit.textContent = 'Sending...';
      try {
        const res = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) {
          submit.disabled = false;
          submit.textContent = label;
          const waHint = cfg.wa ? ' You can also message me on WhatsApp.' : '';
          return showError((out.error || 'Something went wrong.') + (out.notConfigured || res.status >= 500 ? waHint : ''), out.field);
        }
        $('#book-done-text').textContent = 'Thank you. I have your request and will reply by email or WhatsApp to confirm a time.';
        const wa = $('#book-wa');
        if (cfg.wa) {
          const bits = [`Hi, this is ${data.name}.`, 'I just sent a call request on your site.'];
          if (data.preferred_date) bits.push(`Preferred date: ${data.preferred_date}${data.preferred_time ? ` (${data.preferred_time})` : ''}.`);
          wa.href = `https://wa.me/${cfg.wa}?text=${encodeURIComponent(bits.join(' '))}`;
          wa.hidden = false;
        } else wa.hidden = true;
        wrap.hidden = true;
        done.hidden = false;
      } catch {
        submit.disabled = false;
        submit.textContent = label;
        showError('Could not reach the server. Check your connection and try again.');
      }
    });
  }
})();
