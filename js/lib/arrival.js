// Arrivée et départ du voyage (avion, train, voiture) : comment rejoindre l'hébergement depuis
// l'aéroport ou la gare (et l'inverse), avec horaires, durée et tarifs ; puis l'heure d'arrivée
// réelle à l'hébergement, qui sert au planning.
import { transitRoutes } from './transit.js';
import { askAI, hasAI } from './assistant.js';
import { getParty, describeParty } from './party.js';
import { hasGoogle, utcOffsetOf } from './google.js';
import { normTime } from './dates.js';

export const MODES = [
  { id: 'avion', label: 'Avion', icon: 'plane', where: 'Aéroport', at: { arrivee: 'Atterrissage', depart: 'Décollage' } },
  { id: 'train', label: 'Train', icon: 'train', where: 'Gare', at: { arrivee: 'Arrivée du train', depart: 'Départ du train' } },
  { id: 'voiture', label: 'Voiture', icon: 'car', where: '', at: { arrivee: "Arrivée à l'hébergement", depart: "Départ de l'hébergement" } },
];
// Temps pour sortir après l'arrivée (bagages, contrôles) et marge avant le départ.
export const AFTER = { avion: 45, train: 10, voiture: 0 };
export const BEFORE = { avion: 120, train: 20, voiture: 0 };

export const toMin = (t) => {
  const n = normTime(t);
  return n ? +n.slice(0, 2) * 60 + +n.slice(3) : null;
};
export const fromMin = (m) => {
  const x = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

// Date absolue d'une heure locale de la destination (le téléphone peut être sur un autre fuseau).
function localToDate(iso, time, offsetMin) {
  const [h, m] = normTime(time).split(':').map(Number);
  const [y, mo, d] = iso.split('-').map(Number);
  if (offsetMin == null) return new Date(y, mo - 1, d, h, m);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - offsetMin * 60000);
}

// Options proposées par l'IA (toujours, pour les tarifs et les alternatives : taxi, navette…).
async function aiOptions(trip, leg, dir) {
  if (!hasAI()) return [];
  const hotel = trip.lodging;
  const from = dir === 'arrivee' ? leg.place.name : hotel.name;
  const to = dir === 'arrivee' ? hotel.name : leg.place.name;
  const date = dir === 'arrivee' ? trip.startDate : trip.endDate;
  const question = `Voyage en famille à ${trip.city?.name} (${trip.city?.country}). Le ${date}, il faut aller de « ${from} » à « ${to} »${hotel.address ? ` (hébergement : ${hotel.address})` : ''}.
${dir === 'arrivee' ? `Arrivée (${leg.mode}) à ${leg.time}, sortie vers ${fromMin(toMin(leg.time) + AFTER[leg.mode])}.` : `Il faut être à « ${to} » au plus tard à ${fromMin(toMin(leg.time) - BEFORE[leg.mode])} (départ ${leg.mode} à ${leg.time}).`}
Voyageurs : ${describeParty(getParty(trip))}
Donne les 3 à 5 meilleurs moyens (train, métro, bus, navette, taxi / VTC…), du plus conseillé au moins conseillé pour cette famille (bagages, enfants, grossesse). Pour chacun : durée porte à porte, prix TOTAL estimé pour la famille et prix par adulte (devise locale + équivalent en €), fréquence, premier et dernier départ, prochains horaires utiles autour de l'heure indiquée, où acheter le billet, astuce pour payer moins cher (carte sans contact, billet famille, réservation à l'avance…).
Si tu n'es pas sûr d'un chiffre, mets « environ ». Réponds UNIQUEMENT en JSON strict :
{"options":[{"nom":"Thameslink","type":"train|metro|bus|navette|taxi|vtc|tram","recommande":true,"duree_min":45,"prix_famille":"environ 30 £ (35 €)","prix_adulte":"12 £","frequence":"toutes les 15 min","horaires":"premier 05:00, dernier 23:30 ; vers 12:45 : 12:52, 13:07","achat":"carte sans contact aux portiques","astuce":"…"}]}`;
  const text = await askAI({ question, system: 'Tu connais très bien les transports entre aéroports, gares et centres-villes. Tu es précis, prudent et concret.', max: 1400 });
  try {
    const j = JSON.parse((text || '').replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}'));
    return (j.options || []).filter((o) => o?.nom).slice(0, 5);
  } catch {
    return [];
  }
}

// Itinéraires exacts Google (horaires, lignes, tarif) à l'heure voulue.
async function googleOptions(trip, leg, dir) {
  if (!hasGoogle()) return { routes: [], note: '' };
  const hotel = trip.lodging;
  const offset = (await utcOffsetOf(hotel.googleId)) ?? (await utcOffsetOf(leg.place.googleId));
  const iso = dir === 'arrivee' ? trip.startDate : trip.endDate;
  const t = dir === 'arrivee' ? toMin(leg.time) + AFTER[leg.mode] : toMin(leg.time) - BEFORE[leg.mode];
  const when = localToDate(iso, fromMin(t), offset);
  const from = dir === 'arrivee' ? leg.place : hotel;
  const to = dir === 'arrivee' ? hotel : leg.place;
  const clean = (rs) => rs.filter((r) => !r.walkOnly).slice(0, 4).map((r) => ({ ...r, parts: r.parts.map(({ coords, depAt, ...p }) => p), leaveIn: null }));
  try {
    const rs = clean(await transitRoutes(from, to, when, 'TRANSIT', dir === 'depart'));
    if (rs.length) return { routes: rs, note: '' };
  } catch (e) {
    if (e.code === 'no-key' || e.code === 'disabled') return { routes: [], note: '' };
  }
  // Horaires pas encore publiés pour cette date : on montre un jour type (aujourd'hui, même heure).
  try {
    const now = new Date();
    const same = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, Math.floor(t / 60), t % 60);
    const rs = clean(await transitRoutes(from, to, same, 'TRANSIT', dir === 'depart'));
    return { routes: rs, note: rs.length ? 'Horaires d’un jour type (ceux de votre date ne sont pas encore publiés).' : '' };
  } catch {
    return { routes: [], note: '' };
  }
}

// Heure d'arrivée à l'hébergement (arrivée) ou heure où quitter l'hébergement (départ).
export function keyTime(leg, dir, routes = [], ai = []) {
  if (!leg?.time) return null;
  if (leg.mode === 'voiture') return normTime(leg.time);
  const best = routes[0];
  const rec = ai.find((o) => o.recommande) || ai[0];
  if (dir === 'arrivee') {
    if (best?.arr && normTime(best.arr)) {
      const lastWalk = best.parts[best.parts.length - 1]?.type === 'walk' ? best.parts[best.parts.length - 1].min : 0;
      return fromMin(toMin(best.arr) + lastWalk);
    }
    const dur = best?.min || rec?.duree_min || 45;
    return fromMin(toMin(leg.time) + AFTER[leg.mode] + dur);
  }
  if (best?.dep && normTime(best.dep)) {
    const firstWalk = best.parts[0]?.type === 'walk' ? best.parts[0].min : 0;
    return fromMin(toMin(best.dep) - firstWalk - 10);
  }
  const dur = best?.min || rec?.duree_min || 45;
  return fromMin(toMin(leg.time) - BEFORE[leg.mode] - dur - 15);
}

export async function transferPlan(trip, leg, dir) {
  if (!trip.lodging?.lat) throw new Error("Choisissez d'abord l'hébergement du voyage.");
  if (!leg?.place?.lat) throw new Error(dir === 'arrivee' ? "Indiquez l'aéroport ou la gare d'arrivée." : "Indiquez l'aéroport ou la gare de départ.");
  if (!normTime(leg.time)) throw new Error("Indiquez l'heure.");
  const [g, ai] = await Promise.all([googleOptions(trip, leg, dir), aiOptions(trip, leg, dir).catch(() => [])]);
  if (!g.routes.length && !ai.length) throw new Error('Aucun trajet trouvé : ajoutez une clé Google (Routes API) ou une clé IA dans Réglages.');
  return { routes: g.routes, note: g.note, ai, at: Date.now(), key: `${leg.place.name}|${leg.time}|${trip.lodging.name}` };
}

// Pour le planning IA : une phrase qui décrit l'arrivée et le départ.
export function legsText(trip) {
  const out = [];
  const a = trip.arrival;
  if (a?.mode && a.time) out.push(`Arrivée en ${a.mode}${a.place?.name ? ` à ${a.place.name}` : ''} à ${a.time}${trip.arrivalTime ? `, arrivée à l'hébergement vers ${trip.arrivalTime}` : ''}.`);
  const d = trip.departure;
  if (d?.mode && d.time) out.push(`Départ en ${d.mode}${d.place?.name ? ` de ${d.place.name}` : ''} à ${d.time}${trip.departureTime ? `, quitter l'hébergement à ${trip.departureTime}` : ''}.`);
  return out.join(' ');
}
