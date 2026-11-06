// Création d'un voyage et de son contenu de départ.
import { store } from '../core/store.js';
import { checklistTemplate } from '../data/checklistTemplate.js';
import { LONDON_TRIP, LONDON_IDEAS } from '../data/londonSeed.js';

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

export const createLondonTrip = (memberId) => createTrip(LONDON_TRIP, memberId, LONDON_IDEAS);

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
