// Recherche de villes, de lieux et d'informations (sources gratuites, sans clé).
//  - Nominatim (OpenStreetMap) : villes et adresses
//  - Overpass (OpenStreetMap)  : lieux par catégorie autour d'un point
//  - Wikidata / Wikipédia      : photo et histoire des lieux
import { USER_AGENT } from '../config/settings';
import { categoryById } from '../data/categories';
import { currencyForCountry } from './currency';

const HEADERS = { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT, 'Accept-Language': 'fr' };

export async function searchCities(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  return data
    .filter((r) => ['city', 'town', 'village', 'administrative', 'municipality'].includes(r.addresstype) || r.category === 'place' || r.category === 'boundary')
    .map((r) => {
      const cc = (r.address?.country_code || '').toUpperCase();
      return {
        name: r.address?.city || r.address?.town || r.address?.village || r.name,
        label: r.display_name,
        country: r.address?.country || '',
        countryCode: cc,
        currency: currencyForCountry(cc),
        lat: Number(r.lat),
        lon: Number(r.lon),
      };
    });
}

export async function searchAddress(q, near) {
  let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  if (near) {
    const d = 0.3;
    url += `&viewbox=${near.lon - d},${near.lat + d},${near.lon + d},${near.lat - d}`;
  }
  const res = await fetch(url, { headers: HEADERS });
  const data = await res.json();
  return data.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    address: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

async function overpass(query) {
  let lastErr;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

function toPlace(el, categoryId) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  return {
    osmId: `${el.type}/${el.id}`,
    name: t['name:fr'] || t.name || (t.amenity === 'pharmacy' ? 'Pharmacie' : 'Sans nom'),
    category: categoryId,
    lat,
    lon,
    tags: {
      kind: t.amenity || t.tourism || t.leisure || t.shop || t.historic || '',
      cuisine: t.cuisine || '',
      opening_hours: t.opening_hours || '',
      website: t.website || t['contact:website'] || '',
      phone: t.phone || t['contact:phone'] || '',
      wikipedia: t.wikipedia || '',
      wikidata: t.wikidata || '',
      street: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '),
      emergency: t.emergency || '',
      wheelchair: t.wheelchair || '',
      fee: t.fee || '',
    },
  };
}

// Lieux d'une catégorie dans un rayon (mètres) autour d'un point.
export async function fetchPlaces(categoryId, center, radius = 1500, limit = 120) {
  const cat = categoryById(categoryId);
  const around = `(around:${radius},${center.lat},${center.lon})`;
  const parts = cat.query.map((q) => `${q}${around};`).join('');
  const query = `[out:json][timeout:25];(${parts});out center ${limit};`;
  const data = await overpass(query);
  const seen = new Set();
  return (data.elements || [])
    .map((el) => toPlace(el, categoryId))
    .filter((p) => p.lat != null && !seen.has(p.osmId) && seen.add(p.osmId));
}

// Hôpitaux avec urgences / maternités et pharmacies les plus proches.
export async function fetchHealth(center, radius = 4000) {
  const around = `(around:${radius},${center.lat},${center.lon})`;
  const query = `[out:json][timeout:25];(
    nwr["amenity"="hospital"]${around};
    nwr["healthcare"="hospital"]${around};
    nwr["amenity"="pharmacy"]${around};
  );out center 80;`;
  const data = await overpass(query);
  const seen = new Set();
  return (data.elements || [])
    .map((el) => ({ ...toPlace(el, 'sante'), isHospital: (el.tags?.amenity || el.tags?.healthcare) === 'hospital' }))
    .filter((p) => p.lat != null && !seen.has(p.osmId) && seen.add(p.osmId));
}

// Photo + résumé historique en français si possible (sinon langue d'origine).
export async function fetchWikiSummary(tags) {
  try {
    let lang;
    let title;
    if (tags?.wikidata) {
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&ids=${tags.wikidata}`,
        { headers: HEADERS }
      );
      const data = await res.json();
      const links = data.entities?.[tags.wikidata]?.sitelinks || {};
      if (links.frwiki) [lang, title] = ['fr', links.frwiki.title];
      else if (links.enwiki) [lang, title] = ['en', links.enwiki.title];
    }
    if (!title && tags?.wikipedia) {
      const i = tags.wikipedia.indexOf(':');
      [lang, title] = [tags.wikipedia.slice(0, i), tags.wikipedia.slice(i + 1)];
    }
    if (!title) return null;
    const res = await fetch(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { headers: HEADERS }
    );
    if (!res.ok) return null;
    const s = await res.json();
    return {
      text: s.extract,
      image: s.originalimage?.source || s.thumbnail?.source || null,
      url: s.content_urls?.mobile?.page || null,
      lang,
    };
  } catch {
    return null;
  }
}
