// Google Places (API « New »), utilisé seulement si une clé Google est enregistrée dans Réglages.
// Apporte : beaucoup plus de lieux par catégorie (les plus populaires d'abord), notes, avis,
// galeries de photos, horaires, « adapté aux enfants »… Tout est gardé en mémoire sur le
// téléphone pour limiter les appels (et rester dans le quota gratuit).
import { ls } from '../core/config.js';
import { getGoogleKey } from './photos.js';

const API = 'https://places.googleapis.com/v1';
const DAY = 24 * 3600 * 1000;

export const hasGoogle = () => !!getGoogleKey();

// Catégories de l'app → types Google.
const TYPES = {
  restaurants: ['restaurant', 'cafe', 'bakery', 'ice_cream_shop', 'fast_food_restaurant', 'pizza_restaurant'],
  loisirs: ['amusement_park', 'park', 'playground', 'zoo', 'aquarium', 'tourist_attraction', 'bowling_alley', 'amusement_center'],
  shopping: ['shopping_mall', 'department_store', 'book_store', 'clothing_store', 'gift_shop', 'store', 'market'],
  monuments: ['tourist_attraction', 'historical_landmark', 'church', 'monument', 'castle'],
  musees: ['museum', 'art_gallery'],
  pluie: ['museum', 'aquarium', 'movie_theater', 'library', 'shopping_mall', 'bowling_alley', 'amusement_center'],
  sante: ['hospital', 'pharmacy', 'doctor'],
  pratique: ['atm', 'public_bathroom', 'supermarket', 'subway_station'],
};

async function call(path, { method = 'GET', body, fields }) {
  const key = getGoogleKey();
  if (!key) throw new Error('no-key');
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    const err = new Error(d?.error?.message || `Google ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const photoUrl = (name, width = 400) =>
  name ? `${API}/${name}/media?maxWidthPx=${Math.round(width)}&key=${encodeURIComponent(getGoogleKey() || '')}` : null;

const LIST_FIELDS = [
  'id', 'displayName', 'location', 'rating', 'userRatingCount', 'primaryType', 'primaryTypeDisplayName',
  'photos', 'currentOpeningHours.openNow', 'priceLevel', 'shortFormattedAddress',
].map((f) => `places.${f}`).join(',');

function toPlace(g, categoryId) {
  return {
    googleId: g.id,
    name: g.displayName?.text || 'Sans nom',
    category: categoryId,
    lat: g.location?.latitude,
    lon: g.location?.longitude,
    rating: g.rating || null,
    ratings: g.userRatingCount || 0,
    openNow: g.currentOpeningHours?.openNow ?? null,
    price: g.priceLevel || null,
    kind: g.primaryTypeDisplayName?.text || '',
    gphoto: g.photos?.[0]?.name || null,
    tags: { street: g.shortFormattedAddress || '' },
  };
}

// Les 20 lieux les plus populaires d'une catégorie (ou d'une sous-catégorie : boulangerie,
// kebab, distributeurs…) autour d'un point. Gardés 1 jour.
export async function nearbyGoogle(categoryId, center, radius = 1500, sub = null) {
  const key = `g:near:${categoryId}:${sub?.id || ''}:${center.lat.toFixed(3)},${center.lon.toFixed(3)}:${radius}`;
  const hit = ls.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.list;
  const circle = { center: { latitude: center.lat, longitude: center.lon }, radius: Math.min(radius, 50000) };
  let d;
  if (sub?.text) {
    // Pas de type Google dédié (kebab, McDo…) : recherche par mots-clés autour du point.
    d = await call('places:searchText', {
      method: 'POST',
      body: { textQuery: sub.text, maxResultCount: 20, languageCode: 'fr', locationBias: { circle } },
      fields: LIST_FIELDS,
    });
  } else {
    const types = sub?.google || TYPES[categoryId] || ['tourist_attraction'];
    const body = (t) => ({ includedTypes: t, maxResultCount: 20, rankPreference: 'POPULARITY', languageCode: 'fr', locationRestriction: { circle } });
    try {
      d = await call('places:searchNearby', { method: 'POST', body: body(types), fields: LIST_FIELDS });
    } catch (e) {
      // Un type inconnu de Google → on réessaie avec le premier type seulement.
      if (e.status !== 400 || types.length === 1) throw e;
      d = await call('places:searchNearby', { method: 'POST', body: body(types.slice(0, 1)), fields: LIST_FIELDS });
    }
  }
  const list = (d.places || [])
    .map((g) => toPlace(g, categoryId))
    .filter((p) => p.lat != null)
    .filter((p) => !sub?.text || Math.abs(p.lat - center.lat) < 0.03); // reste dans le quartier
  ls.set(key, { at: Date.now(), list });
  return list;
}

// Retrouve l'identifiant Google d'un lieu (nom + position).
async function findId(place, city) {
  const body = { textQuery: `${place.name}${city ? `, ${city}` : ''}`, maxResultCount: 1, languageCode: 'fr' };
  if (place.lat != null) body.locationBias = { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 600 } };
  const d = await call('places:searchText', { method: 'POST', body, fields: 'places.id' });
  return d.places?.[0]?.id || null;
}

const DETAIL_FIELDS = [
  'id', 'displayName', 'location', 'rating', 'userRatingCount', 'reviews', 'photos', 'editorialSummary', 'regularOpeningHours',
  'currentOpeningHours', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri', 'priceLevel', 'goodForChildren',
  'restroom', 'menuForChildren', 'accessibilityOptions', 'googleMapsUri', 'formattedAddress', 'primaryTypeDisplayName',
].join(',');

// Fiche complète (gardée 3 jours).
export async function placeDetails(place, city) {
  if (!hasGoogle() || !place?.name) return null;
  let id = place.googleId || ls.get(`g:id:${place.osmId || place.id || place.name}`);
  if (!id) {
    id = await findId(place, city);
    if (!id) return null;
    ls.set(`g:id:${place.osmId || place.id || place.name}`, id);
  }
  const key = `g:det:${id}`;
  const hit = ls.get(key);
  if (hit && Date.now() - hit.at < 3 * DAY) return hit.d;
  const d = await call(`places/${id}?languageCode=fr`, { fields: DETAIL_FIELDS });
  try {
    ls.set(key, { at: Date.now(), d });
  } catch {
    // stockage plein : tant pis pour le cache
  }
  return d;
}

// Recherche d'une adresse / d'un hôtel autour d'une ville (choix de l'hébergement).
export async function searchGooglePlaces(q, near) {
  const d = await call('places:searchText', {
    method: 'POST',
    body: { textQuery: q, maxResultCount: 6, languageCode: 'fr', locationBias: { circle: { center: { latitude: near.lat, longitude: near.lon }, radius: 30000 } } },
    fields: 'places.id,places.displayName,places.formattedAddress,places.location',
  });
  return (d.places || [])
    .filter((g) => g.location)
    .map((g) => ({ googleId: g.id, name: g.displayName?.text || q, address: g.formattedAddress || '', lat: g.location.latitude, lon: g.location.longitude }));
}

// Hôpitaux et pharmacies les plus proches (classés par distance), avec téléphone. Gardés 1 jour.
export async function healthGoogle(center) {
  const key = `g:health:${center.lat.toFixed(3)},${center.lon.toFixed(3)}`;
  const hit = ls.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.list;
  const fields = 'places.id,places.displayName,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.currentOpeningHours.openNow,places.shortFormattedAddress';
  const one = async (type) => {
    const d = await call('places:searchNearby', {
      method: 'POST',
      body: { includedTypes: [type], maxResultCount: 8, rankPreference: 'DISTANCE', languageCode: 'fr', locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lon }, radius: 15000 } } },
      fields,
    });
    return (d.places || []).filter((g) => g.location).map((g) => ({
      googleId: g.id,
      name: g.displayName?.text || (type === 'hospital' ? 'Hôpital' : 'Pharmacie'),
      lat: g.location.latitude,
      lon: g.location.longitude,
      isHospital: type === 'hospital',
      openNow: g.currentOpeningHours?.openNow ?? null,
      tags: { phone: g.internationalPhoneNumber || g.nationalPhoneNumber || '', opening_hours: '', emergency: '', street: g.shortFormattedAddress || '' },
    }));
  };
  const list = [...(await one('hospital')), ...(await one('pharmacy'))];
  ls.set(key, { at: Date.now(), list });
  return list;
}

// Hôtels autour d'un point (les plus populaires), avec note et gamme de prix. Gardés 1 jour.
export async function hotelsNear(center, radius = 1500) {
  const key = `g:hotels:${center.lat.toFixed(3)},${center.lon.toFixed(3)}:${radius}`;
  const hit = ls.get(key);
  if (hit && Date.now() - hit.at < DAY) return hit.list;
  const d = await call('places:searchNearby', {
    method: 'POST',
    body: { includedTypes: ['hotel', 'lodging'], maxResultCount: 20, rankPreference: 'POPULARITY', languageCode: 'fr', locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lon }, radius: Math.min(radius, 50000) } } },
    fields: `${LIST_FIELDS},places.formattedAddress,places.websiteUri`,
  });
  const list = (d.places || []).filter((g) => g.location).map((g) => ({ ...toPlace(g, 'hebergement'), address: g.formattedAddress || '', website: g.websiteUri || '' }));
  ls.set(key, { at: Date.now(), list });
  return list;
}

// Catégorie de l'app d'après le type Google (pour l'icône et le guide).
function categoryOf(type = '') {
  if (/lodging|hotel|campground|hostel|resort|bed_and_breakfast|motel|guest_house|camping/.test(type)) return 'hebergement';
  if (/restaurant|cafe|bakery|food|bar|ice_cream|meal/.test(type)) return 'restaurants';
  if (/museum|art_gallery/.test(type)) return 'musees';
  if (/park|zoo|aquarium|amusement|playground|bowling|theater|cinema|stadium/.test(type)) return 'loisirs';
  if (/store|shop|mall|market/.test(type)) return 'shopping';
  if (/hospital|pharmacy|doctor/.test(type)) return 'sante';
  if (/atm|station|bathroom|bank/.test(type)) return 'pratique';
  return 'monuments';
}

// Recherche libre sur la carte (« Big Ben », « glacier », « boulangerie »…) autour de la destination.
export async function searchPlaces(q, near) {
  const d = await call('places:searchText', {
    method: 'POST',
    body: { textQuery: q, maxResultCount: 10, languageCode: 'fr', locationBias: { circle: { center: { latitude: near.lat, longitude: near.lon }, radius: 30000 } } },
    fields: `${LIST_FIELDS},places.formattedAddress`,
  });
  return (d.places || [])
    .filter((g) => g.location)
    .map((g) => ({ ...toPlace(g, categoryOf(g.primaryType)), address: g.formattedAddress || g.shortFormattedAddress || '' }));
}

// Décalage horaire actuel du lieu (minutes par rapport à UTC), pour convertir une heure locale.
export async function utcOffsetOf(googleId) {
  if (!googleId) return null;
  try {
    const d = await call(`places/${googleId}`, { fields: 'utcOffsetMinutes' });
    return typeof d.utcOffsetMinutes === 'number' ? d.utcOffsetMinutes : null;
  } catch {
    return null;
  }
}

export const PRICE = { PRICE_LEVEL_FREE: 'Gratuit', PRICE_LEVEL_INEXPENSIVE: '€', PRICE_LEVEL_MODERATE: '€€', PRICE_LEVEL_EXPENSIVE: '€€€', PRICE_LEVEL_VERY_EXPENSIVE: '€€€€' };
