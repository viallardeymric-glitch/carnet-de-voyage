// « Y aller » : ouverture d'Apple Plans, Google Maps ou Citymapper avec le trajet prêt.
import { Linking, Alert } from 'react-native';

export const MODES = [
  { id: 'walk', label: 'À pied', icon: 'walk', apple: 'w', google: 'walking' },
  { id: 'transit', label: 'Transports', icon: 'subway', apple: 'r', google: 'transit' },
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

export function openDirections(place, mode) {
  Alert.alert('Y aller', 'Ouvrir le trajet avec :', [
    { text: 'Plans (Apple)', onPress: () => Linking.openURL(directionsUrl('apple', mode, place)) },
    { text: 'Google Maps', onPress: () => Linking.openURL(directionsUrl('google', mode, place)) },
    ...(mode === 'transit'
      ? [{ text: 'Citymapper', onPress: () => Linking.openURL(directionsUrl('citymapper', mode, place)) }]
      : []),
    { text: 'Annuler', style: 'cancel' },
  ]);
}

export const reviewsUrl = (place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.lat},${place.lon}`)}`;

export const tripadvisorUrl = (place, city) =>
  `https://www.tripadvisor.fr/Search?q=${encodeURIComponent(`${place.name} ${city || ''}`)}`;
