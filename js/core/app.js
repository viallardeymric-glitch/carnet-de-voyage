// État global de l'application (profil, voyage actif, navigation).
import { createContext, useContext } from '../../vendor/preact.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// Navigation par l'ancre de l'URL : #/carte, #/planning, #/lieu …
export const TABS = [
  { id: 'carte', label: 'Carte', icon: 'map-location-dot' },
  { id: 'planning', label: 'Planning', icon: 'calendar-days' },
  { id: 'coffre', label: 'Coffre', icon: 'lock' },
  { id: 'budget', label: 'Budget', icon: 'wallet' },
  { id: 'plus', label: 'Plus', icon: 'grip' },
];

// Objets passés d'un écran à l'autre (ex. un lieu trouvé sur la carte).
export const navState = {};

export function go(route, state) {
  if (state) Object.assign(navState, state);
  location.hash = `#/${route}`;
}
export const back = () => history.back();
export const currentRoute = () => (location.hash.match(/^#\/([a-z-]+)/) || [])[1] || 'carte';
