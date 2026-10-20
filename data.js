// Loads everything the public pages need. Falls back to the starter content when
// Supabase is not configured yet, so the site always renders.
import { isConfigured, sb } from './supabase.js';
import { DEFAULT_SETTINGS, DEFAULT_PROJECTS, DEFAULT_ITEMS } from '../public/shared/defaults.js';

const COLLECTIONS = Object.keys(DEFAULT_ITEMS);

function starterSite(source) {
  const collections = {};
  for (const name of COLLECTIONS) {
    collections[name] = DEFAULT_ITEMS[name].map((data, i) => ({ id: `${name}-${i}`, position: i, data }));
  }
  return {
    source,
    settings: structuredClone(DEFAULT_SETTINGS),
    projects: DEFAULT_PROJECTS.map((p) => ({ ...p, id: p.slug })),
    collections,
  };
}

function mergeSettings(rows) {
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows || []) {
    if (row.key === 'seeded') continue;
    const base = out[row.key] && typeof out[row.key] === 'object' ? out[row.key] : {};
    out[row.key] = { ...base, ...(row.value || {}) };
  }
  return out;
}

export async function loadSite() {
  if (!isConfigured()) return starterSite('starter');

  try {
    const [settingsRows, projects, items] = await Promise.all([
      sb('/rest/v1/site_settings?select=key,value'),
      sb('/rest/v1/projects?select=*&published=eq.true&order=position.asc,created_at.desc'),
      sb('/rest/v1/content_items?select=id,collection,position,data&published=eq.true&order=position.asc,created_at.asc'),
    ]);

    const seeded = (settingsRows || []).some((r) => r.key === 'seeded');
    const hasContent = seeded || (projects || []).length > 0 || (items || []).length > 0;
    if (!hasContent) return starterSite('starter');

    const collections = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    for (const it of items || []) {
      if (collections[it.collection]) collections[it.collection].push({ id: it.id, position: it.position, data: it.data || {} });
    }
    return { source: 'database', settings: mergeSettings(settingsRows), projects: projects || [], collections };
  } catch (err) {
    console.error('[data] falling back to starter content:', err.message);
    return starterSite('fallback');
  }
}

export async function loadProject(slug) {
  const site = await loadSite();
  const project = site.projects.find((p) => p.slug === slug) || null;
  return { site, project };
}
