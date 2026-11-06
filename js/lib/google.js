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

export const PRICE = { PRICE_LEVEL_FREE: 'Gratuit', PRICE_LEVEL_INEXPENSIVE: '€', PRICE_LEVEL_MODERATE: '€€', PRICE_LEVEL_EXPENSIVE: '€€€', PRICE_LEVEL_VERY_EXPENSIVE: '€€€€' };
