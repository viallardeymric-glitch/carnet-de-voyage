// Planning proposé par l'IA : selon les dates, la ville, la famille (âges, grossesse, chien…)
// et les idées déjà notées. Renvoie une proposition à valider avant de l'appliquer.
import { askAI, parseLooseJSON } from './assistant.js';
import { getParty, describeParty } from './party.js';
import { tripDays, formatDay, normTime } from './dates.js';
import { ls } from '../core/config.js';
import { hasGoogle, searchPlaces } from './google.js';
import { searchAddress } from './places.js';
import { savePlace } from './trips.js';
import { legsText } from './arrival.js';
import { store } from '../core/store.js';
import { distanceMeters } from './geo.js';

const CATS = ['monuments', 'musees', 'loisirs', 'restaurants', 'shopping', 'pluie'];

const JSON_SHAPE = `{"days":[{"day":1,"theme":"titre court du jour","items":[{"name":"nom exact du lieu","id":"id de l'idée ou null","category":"${CATS.join('|')}","time":"10:00","note":"conseil court pour la famille"}]}],"tips":["3 conseils généraux maximum"]}`;
const SYSTEM = 'Tu es un organisateur de voyages en famille, précis et réaliste. Tu ne proposes que des lieux qui existent vraiment.';

function context(trip, places) {
  const days = tripDays(trip);
  const party = getParty(trip);
  const ideas = places.map((p) => ({ id: p.id, nom: p.name, cat: p.category, jour: p.day || null, favori: !!p.favorite }));
  const last = days.length;
  return `Destination : ${trip.city?.name} (${trip.city?.country}). Hébergement : ${trip.lodging?.name || 'non choisi'}${trip.lodging?.address ? `, ${trip.lodging.address}` : ''}.
Jours : ${days.map((d) => `Jour ${d.index} = ${formatDay(d.iso)} ${d.iso}`).join(' ; ')}.
${trip.arrivalTime ? `ARRIVÉE à l'hébergement le jour 1 à ${trip.arrivalTime} : aucune activité avant ${trip.arrivalTime} (prévois le temps de poser les valises), la première activité commence au plus tôt 30 à 60 min après, près de l'hébergement.\n` : 'Jour 1 = jour d’arrivée : commence tranquillement.\n'}${trip.departureTime ? `DÉPART le jour ${last} : il faut QUITTER l'hébergement à ${trip.departureTime} (bagages) : aucune activité qui finit après ${trip.departureTime} moins 30 min, rien de loin de l'hébergement ce jour-là.\n` : ''}${legsText(trip) ? `Transport : ${legsText(trip)} N'ajoute PAS le trajet aéroport / gare dans les activités (il est déjà prévu).\n` : ''}Voyageurs : ${describeParty(party)}${ls.get('partyNotes', '') ? ` Notes : ${ls.get('partyNotes', '')}` : ''}
Idées déjà notées (réutilise-les en priorité avec leur id, surtout les favoris) : ${JSON.stringify(ideas).slice(0, 3000)}
Règles : rythme adapté au groupe (enfants, grossesse : pauses, pas de longues marches, une pause repos l'après-midi si besoin), 2 à 4 activités par jour regroupées par quartier pour limiter les trajets, premier et dernier jour plus légers (arrivée / départ), tiens compte des jours fériés, fermetures (lundi / mardi pour certains musées) et de la saison (activité couverte prévue en cas de pluie), un repas conseillé par jour adapté aux enfants (indique-le comme un lieu, catégorie restaurants).
TRÈS IMPORTANT : tous les lieux doivent se trouver à ${trip.city?.name} ou tout près (moins de 20 km de l'hébergement, sans traverser la mer ni changer de pays), sauf si les envies demandent explicitement une excursion. Donne des noms précis et réels de lieux de ${trip.city?.name} (nom complet, pas un nom générique). N'ajoute JAMAIS l'hébergement ni un autre camping / hôtel comme activité : l'installation et le rangement des bagages ne sont pas des activités.`;
}

// L'IA place parfois l'hébergement (ou un camping voisin) comme activité « s'installer » : on l'écarte.
const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function isLodgingLike(name, trip) {
  const n = norm(name);
  const l = norm(trip.lodging?.name);
  if (l && (n.includes(l) || (n.length > 8 && l.includes(n)))) return true;
  return /\bcamping\b|\bmobil home\b|\bairbnb\b|\bgite\b/.test(n);
}

// Cherche un lieu proposé par l'IA SUR PLACE : un homonyme à l'autre bout du pays (ou en Angleterre)
// est refusé. Rien trouvé dans le rayon → null (le lieu reste sans position plutôt que faux).
export async function locateNear(name, trip, maxKm = 25) {
  const near = trip.lodging?.lat ? trip.lodging : trip.city;
  const ok = (p) => p?.lat != null && distanceMeters(near, p) <= maxKm * 1000;
  if (hasGoogle()) {
    for (const q of [`${name} ${trip.city?.name || ''}`, name]) {
      try {
        const hit = (await searchPlaces(q, near)).find(ok);
        if (hit) return hit;
      } catch {
        /* essai suivant */
      }
    }
  }
  try {
    const r = (await searchAddress(`${name} ${trip.city?.name || ''}`, trip.city)).find(ok) || (await searchAddress(name, trip.city)).find(ok);
    if (r) return { name, lat: r.lat, lon: r.lon, tags: { street: r.address?.split(',').slice(0, 2).join(',') || '' } };
  } catch {
    /* introuvable */
  }
  return null;
}

// Lecture tolérante (réponse coupée, texte autour) puis nettoyage : jours valides, heures « 09:30 »…
function parsePlan(text, trip, places, { allowEmpty = false } = {}) {
  const days = tripDays(trip);
  let plan;
  try {
    plan = parseLooseJSON(text);
  } catch {
    throw new Error("L'IA a répondu dans un format inattendu, réessayez.");
  }
  if (!Array.isArray(plan.days) || (!plan.days.length && !allowEmpty)) throw new Error("L'IA n'a pas proposé de jours, réessayez.");
  const ids = new Set(places.map((p) => p.id));
  plan.days = plan.days
    .filter((d) => d && +d.day >= 1 && +d.day <= days.length)
    .map((d) => ({
      ...d,
      day: +d.day,
      items: (d.items || [])
        .filter((i) => i?.name && !isLodgingLike(i.name, trip))
        .map((i) => ({ ...i, time: normTime(i.time), id: ids.has(i.id) ? i.id : null, category: CATS.includes(i.category) ? i.category : 'monuments' }))
        .sort((a, b) => (a.time || '99').localeCompare(b.time || '99')),
    }))
    .sort((a, b) => a.day - b.day);
  if (!plan.days.length && !allowEmpty) throw new Error("L'IA n'a pas proposé de jours, réessayez.");
  return plan;
}

const CHUNK = 5; // jours demandés à la fois : une réponse courte, donc complète et rapide

export async function proposePlanning(trip, places, wishes = '', onProgress) {
  const all = tripDays(trip);
  const out = { days: [], tips: [] };
  const part = all.length > CHUNK;
  const ask = async (from, to) => {
    onProgress?.(from, to, all.length);
    const done = out.days.flatMap((d) => d.items.map((i) => `J${d.day} ${i.name}`));
    const question = `Propose un planning de voyage jour par jour${part ? ` (voyage de ${all.length} jours ; ne planifie ICI QUE les jours ${from} à ${to})` : ''}.
${context(trip, places)}
${wishes ? `Envies particulières : ${wishes}\n` : ''}${done.length ? `Déjà prévu les autres jours (ne le répète pas, varie les activités) : ${done.join(' ; ').slice(0, 1500)}\n` : ''}Réponds UNIQUEMENT en JSON strict, sans texte autour${part ? `, avec seulement les jours ${from} à ${to}` : ''} :
${JSON_SHAPE}`;
    const plan = await askAI({ question, system: SYSTEM, max: 500 + (to - from + 1) * 450, json: true, timeout: 45000, parse: (t) => parsePlan(t, trip, places, { allowEmpty: true }) });
    out.days.push(...plan.days.filter((d) => d.day >= from && d.day <= to && d.items.length && !out.days.some((x) => x.day === d.day)));
    if (!out.tips.length && plan.tips?.length) out.tips = plan.tips.slice(0, 3);
  };
  for (let from = 1; from <= all.length; from += CHUNK) await ask(from, Math.min(all.length, from + CHUNK - 1));
  // Jours manquants (réponse coupée) : on les redemande une fois.
  const missing = all.map((d) => d.index).filter((i) => !out.days.some((d) => d.day === i));
  for (let k = 0; k < missing.length; k += CHUNK) {
    const grp = missing.slice(k, k + CHUNK);
    try {
      await ask(grp[0], grp[grp.length - 1]);
    } catch {
      /* on garde ce qu'on a */
    }
  }
  if (!out.days.length) throw new Error("L'IA n'a pas proposé de jours, réessayez.");
  out.days.sort((a, b) => a.day - b.day);
  return out;
}

// Ajustement par petites demandes (« alléger le jour 2 », « Big Ben vers 17 h », « fish & chips mardi »…) :
// l'IA repart du planning actuel et ne renvoie QUE les jours qu'elle change (réponse courte, même pour
// un long séjour) ; on les remplace dans le planning.
export async function refinePlanning(trip, places, plan, request, history = []) {
  const compact = { days: plan.days.map((d) => ({ day: d.day, theme: d.theme, items: d.items.map(({ name, id, category, time, note }) => ({ name, id, category, time, note })) })), tips: plan.tips || [] };
  const question = `Voici le planning de voyage actuel, que la famille aime presque tel quel :
${JSON.stringify(compact)}
${context(trip, places)}
${history.length ? `Demandes déjà prises en compte (à conserver) : ${history.map((h) => `« ${h} »`).join(' ; ')}\n` : ''}NOUVELLE DEMANDE à appliquer : « ${request} »
Modifie UNIQUEMENT ce que la demande concerne (et ce qu'il faut décaler en conséquence, horaires compris). Garde tout le reste identique : mêmes lieux, mêmes heures, mêmes id.
Réponds UNIQUEMENT en JSON strict, sans texte autour, avec SEULEMENT les jours modifiés (chaque jour modifié en entier, avec tous ses lieux) :
${JSON_SHAPE}`;
  const changed = await askAI({ question, system: SYSTEM, max: 3500, json: true, timeout: 45000, parse: (t) => parsePlan(t, trip, places) });
  const byDay = new Map(changed.days.map((d) => [d.day, d]));
  return {
    days: [...plan.days.filter((d) => !byDay.has(d.day)), ...changed.days].sort((a, b) => a.day - b.day),
    tips: changed.tips?.length ? changed.tips : plan.tips || [],
  };
}

// Applique la proposition : les idées existantes sont placées dans leur jour, les nouveaux lieux
// sont cherchés (Google, sinon OpenStreetMap) puis ajoutés au jour.
export async function applyPlanning(trip, tripId, places, plan, memberId, onProgress, { unplanMissing = false } = {}) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const total = plan.days.reduce((a, d) => a + d.items.length, 0);
  let done = 0;
  for (const d of plan.days) {
    let order = 0;
    for (const it of d.items) {
      const patch = { day: d.day, order: order++, time: it.time || null, aiNote: it.note || null };
      if (it.id && byId.has(it.id)) await savePlace(tripId, byId.get(it.id), patch);
      else {
        const found = await locateNear(it.name, trip);
        await savePlace(tripId, { ...(found || { name: it.name, lat: null, lon: null, tags: {} }), name: found?.name || it.name, category: it.category }, patch, memberId);
      }
      onProgress?.(++done, total);
    }
  }
  // Retouche du planning en place : un lieu retiré par l'IA (jour allégé) retourne dans la boîte à idées.
  if (unplanMissing) {
    const kept = new Set(plan.days.flatMap((d) => d.items.map((i) => i.id).filter(Boolean)));
    for (const p of places) if (p.day && !kept.has(p.id)) await savePlace(tripId, p, { day: null, time: null });
  }
  await store.update(`trips/${tripId}`, { dayThemes: Object.fromEntries(plan.days.map((d) => [d.day, d.theme || ''])), aiTips: plan.tips || [] });
}
