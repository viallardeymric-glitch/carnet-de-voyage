// Photos des lieux (miniatures).
// Ordre : Google Places si une clé Google est enregistrée (Réglages) → Wikidata (photo officielle)
// → article Wikipédia lié → articles Wikipédia à moins de 300 m dont le titre ressemble au nom
// → photos Wikimedia Commons prises sur place → recherche Wikipédia par nom.
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

export const getGoogleKey = () => ls.get('googleKey', null);
export function setGoogleKey(k) {
  ls.set('googleKey', k || null);
  // On oublie les « pas de photo » pour retenter avec Google.
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k2 = localStorage.key(i);
    if (k2?.startsWith('cdv::photo:') && !JSON.parse(localStorage.getItem(k2) || '{}').url) localStorage.removeItem(k2);
  }
}

// Google Places (API « New ») : une recherche texte près du lieu, puis l'URL de sa première photo.
async function fromGoogle(key, place, city, width) {
  const body = { textQuery: `${place.name}${city ? `, ${city}` : ''}`, maxResultCount: 1, languageCode: 'fr' };
  if (place.lat != null) body.locationBias = { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 800 } };
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.photos' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status);
  const d = await res.json();
  const photo = d.places?.[0]?.photos?.[0]?.name;
  return photo ? `https://places.googleapis.com/v1/${photo}/media?maxWidthPx=${width * 2}&key=${encodeURIComponent(key)}` : null;
}

// Photos déposées sur Wikimedia Commons à moins de 150 m, dont le nom de fichier ressemble au lieu.
async function commonsNear(place, width) {
  const d = await getJson(
    `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsnamespace=6&ggscoord=${place.lat}%7C${place.lon}&ggsradius=150&ggslimit=40&prop=imageinfo&iiprop=url&iiurlwidth=${width}`
  );
  const pages = Object.values(d.query?.pages || {})
    .filter((p) => /\.(jpe?g|png|webp)$/i.test(p.title))
    .map((p) => ({ title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), index: p.index, thumbnail: { source: p.imageinfo?.[0]?.thumburl } }));
  return best(pages, place.name, 0.5);
}

// Galerie en plus des 10 photos Google (leur maximum) : photos libres de Wikimedia Commons
// prises sur place. D'abord celles dont le nom évoque le lieu, puis celles prises à quelques mètres.
export async function commonsGallery(place, max = 20) {
  if (place?.lat == null) return [];
  const key = `photo:gal:${place.lat.toFixed(4)},${place.lon.toFixed(4)}`;
  const hit = ls.get(key);
  if (hit) return hit;
  try {
    const d = await getJson(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggsnamespace=6&ggscoord=${place.lat}%7C${place.lon}&ggsradius=300&ggslimit=80&prop=imageinfo|coordinates&iiprop=url&iiurlwidth=900`
    );
    const words = (place.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const list = Object.values(d.query?.pages || {})
      .filter((p) => /\.(jpe?g|webp)$/i.test(p.title) && p.imageinfo?.[0]?.thumburl)
      .map((p) => {
        const t = p.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const c = p.coordinates?.[0];
        const dist = c ? Math.hypot((c.lat - place.lat) * 111000, (c.lon - place.lon) * 111000 * Math.cos((place.lat * Math.PI) / 180)) : 999;
        return { small: p.imageinfo[0].thumburl, big: commons(p.title.replace(/^File:/, ''), 1600), match: words.some((w) => t.includes(w)), dist };
      })
      .filter((x) => x.match || x.dist < 60)
      .sort((a, b) => b.match - a.match || a.dist - b.dist)
      .slice(0, max)
      .map(({ small, big }) => ({ small, big }));
    ls.set(key, list);
    return list;
  } catch {
    return [];
  }
}

async function resolve(place, city, width) {
  const t = place.tags || {};
  const steps = [];
  const gkey = getGoogleKey();
  if (gkey) steps.push(() => fromGoogle(gkey, place, city, width));
  if (t.wikidata) steps.push(() => fromWikidata(t.wikidata, width));
  if (t.wikipedia) steps.push(() => fromWikipediaTag(t.wikipedia, width));
  if (place.lat != null && place.name) {
    steps.push(() => nearby('en', place, width));
    steps.push(() => nearby('fr', place, width));
    steps.push(() => commonsNear(place, width));
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
  const gk = place.gphoto && getGoogleKey();
  if (gk) return `https://places.googleapis.com/v1/${place.gphoto}/media?maxWidthPx=${width * 2}&key=${encodeURIComponent(gk)}`;
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

// Grande photo de couverture d'une ville (article Wikipédia en français, sinon anglais).
export async function cityPhoto(city, width = 900) {
  if (!city) return null;
  const key = `photo:city:${city}`;
  const hit = ls.get(key);
  if (hit && (hit.url || Date.now() - hit.at < WEEK)) return hit.url;
  let url = null;
  let failed = false;
  for (const lang of ['fr', 'en']) {
    try {
      url = await fromWikipediaTag(`${lang}:${city}`, width);
      if (url) break;
    } catch {
      failed = true;
    }
  }
  if (url || !failed) ls.set(key, { url, at: Date.now() });
  return url;
}

// Article Wikipédia correspondant à un lieu (même méthode que pour les photos), en français si possible.
async function titleNear(lang, place) {
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=geosearch&gscoord=${place.lat}%7C${place.lon}&gsradius=400&gslimit=30`
  );
  let pick = null;
  for (const p of d.query?.geosearch || []) {
    const sc = likeness(place.name, p.title);
    if (sc >= 0.5 && (!pick || sc > pick.sc)) pick = { sc, title: p.title };
  }
  return pick?.title || null;
}
async function titleByName(lang, place, city) {
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&list=search&srsearch=${encodeURIComponent(`${norm(place.name)} ${city || ''}`)}&srlimit=3`
  );
  const hit = (d.query?.search || []).find((p) => likeness(place.name, p.title) >= 0.6);
  return hit?.title || null;
}
async function toFrench(title) {
  const d = await getJson(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=langlinks&lllang=fr&titles=${encodeURIComponent(title)}`);
  const page = Object.values(d.query?.pages || {})[0];
  return page?.langlinks?.[0]?.['*'] || null;
}

export async function findArticle(place, city) {
  const key = `wiki:${photoKey(place)}`;
  const hit = ls.get(key);
  if (hit && (hit.title || Date.now() - hit.at < WEEK)) return hit.title ? hit : null;
  let res = null;
  try {
    const t = place.tags || {};
    if (t.wikipedia) {
      const i = t.wikipedia.indexOf(':');
      res = { lang: t.wikipedia.slice(0, i), title: t.wikipedia.slice(i + 1) };
    }
    if (!res && place.lat != null) {
      const fr = await titleNear('fr', place);
      if (fr) res = { lang: 'fr', title: fr };
      else {
        const en = await titleNear('en', place);
        if (en) res = { lang: 'en', title: en };
      }
    }
    if (!res && place.name) {
      const fr = await titleByName('fr', place, city);
      res = fr ? { lang: 'fr', title: fr } : null;
      if (!res) {
        const en = await titleByName('en', place, city);
        if (en) res = { lang: 'en', title: en };
      }
    }
    if (res?.lang === 'en') {
      const fr = await toFrench(res.title).catch(() => null);
      if (fr) res = { lang: 'fr', title: fr };
    }
  } catch {
    return null; // réseau : on ne mémorise rien
  }
  ls.set(key, { ...(res || {}), at: Date.now() });
  return res;
}

// Texte de l'article (début, environ 5 000 caractères), en paragraphes.
export async function articleText({ lang, title }) {
  const d = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=extracts&explaintext=1&exsectionformat=plain&exchars=5000&titles=${encodeURIComponent(title)}`
  );
  const page = Object.values(d.query?.pages || {})[0];
  const text = (page?.extract || '').replace(/\n{2,}/g, '\n').trim();
  return text ? { text, url: `https://${lang}.m.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, lang } : null;
}
