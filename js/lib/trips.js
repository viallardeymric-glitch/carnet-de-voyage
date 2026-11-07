// Création d'un voyage et de son contenu de départ.
import { store } from '../core/store.js';
import { checklistTemplate } from '../data/checklistTemplate.js';

export async function createTrip(data, memberId, ideas = []) {
  const id = await store.add('trips', { ...data, createdBy: memberId, createdAtMs: Date.now() });
  for (const item of checklistTemplate(data.city?.countryCode)) {
    await store.add(`trips/${id}/checklist`, { ...item, createdBy: memberId });
  }
  let i = 0;
  for (const idea of ideas) {
    await store.add(`trips/${id}/places`, {
      tags: {},
      ...idea,
      day: null,
      order: i++,
      status: 'todo',
      favorite: false,
      addedBy: memberId,
      createdAtMs: Date.now(),
    });
  }
  return id;
}

// Lieux : boîte à idées / planning
export async function savePlace(tripId, place, patch, memberId) {
  // eslint-disable-next-line no-unused-vars
  const { id, distance, walk, d, ...data } = place;
  if (id) {
    await store.update(`trips/${tripId}/places/${id}`, patch);
    return id;
  }
  return store.add(`trips/${tripId}/places`, {
    ...data,
    day: null,
    order: Date.now(),
    status: 'todo',
    favorite: false,
    addedBy: memberId,
    createdAtMs: Date.now(),
    ...patch,
  });
}

export const removePlace = (tripId, id) => store.remove(`trips/${tripId}/places/${id}`);

export async function reorder(tripId, ordered) {
  await Promise.all(ordered.map((p, i) => store.update(`trips/${tripId}/places/${p.id}`, { order: i })));
}

// Recale l'hébergement s'il a été placé sur un homonyme loin de la destination
// (ex. un « Bois d'Amour » à l'autre bout de la Bretagne). Une seule vérification par voyage.
export async function verifyLodging(trip, tripId) {
  const l = trip?.lodging;
  const c = trip?.city;
  if (!l || !c || l.verified || l.lat == null || !tripId) return;
  const { hasGoogle, searchGooglePlaces } = await import('./google.js');
  if (!hasGoogle()) return;
  const { distanceMeters } = await import('./geo.js');
  try {
    const [best] = await searchGooglePlaces(`${l.name}, ${c.name}`, c);
    const patch = { ...l, verified: true };
    let moved = false;
    if (best && distanceMeters(best, l) > 1500 && distanceMeters(best, c) < distanceMeters(l, c)) {
      Object.assign(patch, { lat: best.lat, lon: best.lon, address: best.address || l.address, googleId: best.googleId });
      moved = true;
    }
    await store.update(`trips/${tripId}`, { lodging: patch });
    return moved ? patch : null;
  } catch {
    // réseau ou quota : on réessaiera à la prochaine ouverture
  }
}
