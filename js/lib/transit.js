// Transports en commun dans l'app : prochains départs, lignes et arrêts (Google Routes API),
// plan du réseau de la ville, et l'IA en secours si Google ne répond pas.
import { ls } from '../core/config.js';
import { getGoogleKey } from './photos.js';
import { askAI, hasAI } from './assistant.js';

export const ROUTES_HELP = 'https://console.cloud.google.com/apis/library/routes.googleapis.com';

const FIELDS = [
  'routes.duration', 'routes.distanceMeters', 'routes.localizedValues',
  'routes.legs.steps.travelMode', 'routes.legs.steps.staticDuration', 'routes.legs.steps.distanceMeters',
  'routes.legs.steps.navigationInstruction', 'routes.legs.steps.transitDetails', 'routes.legs.steps.localizedValues',
  'routes.legs.steps.polyline', 'routes.legs.steps.startLocation', 'routes.travelAdvisory.transitFare',
].join(',');

// Décodage des tracés Google (« encoded polyline ») en [lon, lat].
export function decodePolyline(str = '') {
  const out = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const k of [0, 1]) {
      let b, shift = 0, res = 0;
      do {
        b = str.charCodeAt(i++) - 63;
        res |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k === 0) lat += d;
      else lon += d;
    }
    out.push([lon / 1e5, lat / 1e5]);
  }
  return out;
}

// Tarif Google ({ currencyCode, units, nanos }) → « 12,40 £ ».
function fareText(f) {
  if (!f || (f.units == null && f.nanos == null)) return '';
  const v = +(f.units || 0) + (f.nanos || 0) / 1e9;
  try {
    return v.toLocaleString('fr-FR', { style: 'currency', currency: f.currencyCode || 'EUR' });
  } catch {
    return `${v.toFixed(2)} ${f.currencyCode || ''}`;
  }
}

const mins = (d) => Math.max(1, Math.round(parseInt(d || '0', 10) / 60));
const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');

// Itinéraires en transports (jusqu'à 4 propositions), au départ de maintenant ou d'une heure donnée.
export async function transitRoutes(from, to, when = null, travelMode = 'TRANSIT', arriveBy = false) {
  const key = getGoogleKey();
  if (!key) throw Object.assign(new Error('no-key'), { code: 'no-key' });
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lon } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lon } } },
      travelMode,
      computeAlternativeRoutes: travelMode === 'TRANSIT',
      languageCode: 'fr',
      ...(when ? { [arriveBy ? 'arrivalTime' : 'departureTime']: new Date(when).toISOString() } : {}),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    const msg = d?.error?.message || `Google ${res.status}`;
    throw Object.assign(new Error(msg), { code: res.status === 403 || /not been used|disabled|not enabled/i.test(msg) ? 'disabled' : 'error' });
  }
  const d = await res.json();
  return (d.routes || []).map((r) => {
    const steps = (r.legs || []).flatMap((l) => l.steps || []);
    // On regroupe les pas de marche consécutifs.
    const parts = [];
    for (const s of steps) {
      if (s.travelMode === 'TRANSIT' && s.transitDetails) {
        const t = s.transitDetails;
        const line = t.transitLine || {};
        parts.push({
          type: 'transit',
          vehicle: line.vehicle?.name?.text || 'Transport',
          vehicleType: line.vehicle?.type || '',
          line: line.nameShort || line.name || '',
          lineName: line.name || '',
          color: line.color || '#555',
          textColor: line.textColor || '#fff',
          headsign: t.headsign || '',
          from: t.stopDetails?.departureStop?.name || '',
          to: t.stopDetails?.arrivalStop?.name || '',
          dep: t.localizedValues?.departureTime?.time?.text || hhmm(t.stopDetails?.departureTime),
          arr: t.localizedValues?.arrivalTime?.time?.text || hhmm(t.stopDetails?.arrivalTime),
          depAt: t.stopDetails?.departureTime || null,
          stops: t.stopCount || 0,
          min: mins(s.staticDuration),
          coords: decodePolyline(s.polyline?.encodedPolyline),
        });
      } else {
        const last = parts[parts.length - 1];
        const m = mins(s.staticDuration);
        const coords = decodePolyline(s.polyline?.encodedPolyline);
        if (last?.type === 'walk') {
          last.min += m;
          last.m += s.distanceMeters || 0;
          last.coords.push(...coords);
        } else parts.push({ type: 'walk', min: m, m: s.distanceMeters || 0, coords });
      }
    }
    const firstT = parts.find((p) => p.type === 'transit');
    const lastT = [...parts].reverse().find((p) => p.type === 'transit');
    return {
      min: mins(r.duration),
      parts: parts.filter((p) => p.type === 'transit' || p.min >= 1),
      dep: firstT?.dep || '',
      arr: lastT?.arr || '',
      leaveIn: firstT?.depAt ? Math.round((new Date(firstT.depAt) - Date.now()) / 60000) - (parts[0]?.type === 'walk' ? parts[0].min : 0) : null,
      walkOnly: !firstT,
      fare: fareText(r.travelAdvisory?.transitFare),
    };
  });
}

// Secours sans Google : l'IA explique comment y aller (lignes probables, à vérifier sur place).
export async function transitByAI(fromName, to, city) {
  if (!hasAI()) return null;
  const key = `transitAI:${fromName}:${to.name}`;
  const hit = ls.get(key);
  if (hit) return hit;
  const text = await askAI({
    question: `À ${city}, comment aller en transports en commun de « ${fromName} » à « ${to.name} » (${to.lat?.toFixed?.(4)}, ${to.lon?.toFixed?.(4)}) avec une famille (poussette / grossesse) ? Donne 3 à 5 lignes avec « - » : ligne(s) à prendre, arrêt de départ et d'arrivée, durée approximative, ticket à utiliser. Précise « à vérifier » pour ce qui est incertain.`,
    system: 'Tu connais bien les réseaux de transports urbains. Réponds en français, concis et prudent.',
    max: 500,
  });
  if (text) ls.set(key, text);
  return text;
}

// Plans officiels des réseaux pour les grandes villes ; sinon une recherche ciblée.
const PLANS = {
  londres: [['Plan du métro (Tube)', 'https://tfl.gov.uk/maps/track/tube'], ['Plans des bus', 'https://tfl.gov.uk/maps/bus']],
  london: [['Plan du métro (Tube)', 'https://tfl.gov.uk/maps/track/tube'], ['Plans des bus', 'https://tfl.gov.uk/maps/bus']],
  paris: [['Plans RATP (métro, RER, bus)', 'https://www.ratp.fr/plans']],
  lyon: [['Plans TCL', 'https://www.tcl.fr/plans']],
  barcelone: [['Plans TMB', 'https://www.tmb.cat/fr/plans-de-transport']],
  madrid: [['Plan du métro', 'https://www.metromadrid.es/es/viaja-en-metro/mapa-de-metro']],
  rome: [['Plans ATAC', 'https://www.atac.roma.it/mappe']],
  lisbonne: [['Plan du métro', 'https://www.metrolisboa.pt/viajar/mapas-e-diagramas/']],
  amsterdam: [['Plans GVB', 'https://reisinfo.gvb.nl/fr/plans']],
  bruxelles: [['Plans STIB', 'https://www.stib-mivb.be/network-maps']],
  berlin: [['Plans BVG', 'https://www.bvg.de/de/verbindungen/linienuebersicht']],
  'new york': [['Subway map (MTA)', 'https://new.mta.info/map/5256']],
};
export function networkPlans(city) {
  const k = (city || '').toLowerCase();
  const found = Object.entries(PLANS).find(([name]) => k.includes(name));
  const search = ['Rechercher le plan du réseau', `https://www.google.com/search?q=${encodeURIComponent(`plan réseau transports ${city || ''} métro bus pdf`)}`];
  return found ? [...found[1], search] : [search];
}
