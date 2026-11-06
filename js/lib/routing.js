// « Y aller » : ouverture d'Apple Plans, Google Maps ou Citymapper avec le trajet prêt.
import { actionSheet } from '../ui/dialogs.js';

export const MODES = [
  { id: 'walk', label: 'À pied', icon: 'person-walking', apple: 'w', google: 'walking' },
  { id: 'transit', label: 'Transports', icon: 'train-subway', apple: 'r', google: 'transit' },
  { id: 'car', label: 'Voiture / taxi', icon: 'car', apple: 'd', google: 'driving' },
];

export function directionsUrl(app, mode, place) {
  const m = MODES.find((x) => x.id === mode) || MODES[0];
  const dest = `${place.lat},${place.lon}`;
  const name = encodeURIComponent(place.name || '');
  if (app === 'apple') return `https://maps.apple.com/?daddr=${dest}&q=${name}&dirflg=${m.apple}`;
  if (app === 'citymapper') return `https://citymapper.com/directions?endcoord=${dest}&endname=${name}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${m.google}`;
}

export async function openDirections(place, mode) {
  const apps = [
    { label: 'Plans (Apple)', value: 'apple' },
    { label: 'Google Maps', value: 'google' },
    ...(mode === 'transit' ? [{ label: 'Citymapper', value: 'citymapper' }] : []),
  ];
  const app = await actionSheet('Y aller', 'Ouvrir le trajet avec :', apps);
  if (app) window.open(directionsUrl(app, mode, place), '_blank');
}

export const reviewsUrl = (place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.lat},${place.lon}`)}`;

export const tripadvisorUrl = (place, city) =>
  `https://www.tripadvisor.fr/Search?q=${encodeURIComponent(`${place.name} ${city || ''}`)}`;
