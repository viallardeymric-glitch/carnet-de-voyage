// Photos des lieux (miniatures) depuis Wikipédia / Wikimedia Commons, gratuites et sans clé.
// Ordre : Wikidata (photo officielle P18) → article Wikipédia lié → articles Wikipédia
// situés à moins de 300 m dont le titre ressemble au nom du lieu → recherche par nom.
// Les résultats (y compris « pas de photo ») sont gardés sur le téléphone.
import { ls } from '../core/config.js';

const WEEK = 7 * 24 * 3600 * 1000;
const STOP = new Set(['the', 'of', 'and', 'de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'pour', 'london', 'londres', 'gratuit', 'ans']);

const norm = (s) =>
  String(s || '')
    .replace(/\(.*?\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const words = (s) => norm(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w));

// Part des mots du nom du lieu que l'on retrouve dans le titre de l'article (0 → 1).
function likeness(name, title) {
  const a = words(name);
  if (!a.length) return 0;
  const b = new Set(words(title));
  return a.filter((w) => b.has(w)).length / a.length;
}

const commons = (file, width) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status);
  return res.json();
}

async function fromWikidata(id, width) {
  const d = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=claims&ids=${id}`);
  const file = d.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file ? commons(file, width) : null;
}

async function fromWikipediaTag(tag, width) {
  const i = tag.indexOf(':');
  const [lang, title] = [tag.slice(0, i) || 'en', tag.slice(i + 1)];
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=${width}&titles=${encodeURIComponent(title)}`
  );
  const page = Object.values(d.query?.pages || {})[0];
  return page?.thumbnail?.source || null;
}

function best(pages, name, min) {
  let pick = null;
  for (const p of pages) {
    if (!p.thumbnail?.source) continue;
    const s = likeness(name, p.title);
    const rank = p.index ?? 99;
    if (s >= min && (!pick || s > pick.s || (s === pick.s && rank < pick.rank))) pick = { s, rank, url: p.thumbnail.source };
  }
  return pick?.url || null;
}

async function nearby(lang, place, width) {
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${place.lat}%7C${place.lon}&ggsradius=300&ggslimit=20&prop=pageimages&piprop=thumbnail&pithumbsize=${width}`
  );
  return best(Object.values(d.query?.pages || {}), place.name, 0.5);
}

async function byName(lang, place, city, width) {
  const q = `${norm(place.name)} ${city || ''}`.trim();
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=${width}`
  );
  return best(Object.values(d.query?.pages || {}), place.name, 0.6);
}

async function resolve(place, city, width) {
  const t = place.tags || {};
  const steps = [];
  if (t.wikidata) steps.push(() => fromWikidata(t.wikidata, width));
  if (t.wikipedia) steps.push(() => fromWikipediaTag(t.wikipedia, width));
  if (place.lat != null && place.name) {
    steps.push(() => nearby('en', place, width));
    steps.push(() => nearby('fr', place, width));
  }
  if (place.name) {
    steps.push(() => byName('en', place, city, width));
    steps.push(() => byName('fr', place, city, width));
  }
  let failed = false;
  for (const step of steps) {
    try {
      const url = await step();
      if (url) return { url };
    } catch {
      failed = true; // réseau absent ou réponse inattendue : on passe à la source suivante
    }
  }
  return { url: null, failed };
}

// Trois recherches à la fois au maximum, pour rester léger sur le réseau.
let running = 0;
const waiting = [];
const slot = () => (running < 3 ? (running++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
const release = () => (waiting.length ? waiting.shift()() : running--);

const pending = new Map();

export function photoKey(place) {
  return place.osmId || place.tags?.wikidata || `${norm(place.name)}@${place.lat?.toFixed?.(3) ?? ''}`;
}

export function cachedPhoto(place, width = 240) {
  const hit = ls.get(`photo:${width}:${photoKey(place)}`);
  if (!hit) return undefined;
  if (!hit.url && Date.now() - hit.at > WEEK) return undefined; // on retentera plus tard
  return hit.url;
}

export function findPhoto(place, { city, width = 240 } = {}) {
  if (!place?.name) return Promise.resolve(null);
  const cached = cachedPhoto(place, width);
  if (cached !== undefined) return Promise.resolve(cached);
  const key = `photo:${width}:${photoKey(place)}`;
  if (pending.has(key)) return pending.get(key);
  const job = slot()
    .then(() => resolve(place, city, width))
    .then(({ url, failed }) => {
      if (url || !failed) ls.set(key, { url, at: Date.now() });
      return url;
    })
    .finally(() => {
      release();
      pending.delete(key);
    });
  pending.set(key, job);
  return job;
}
