// Planning proposé par l'IA : selon les dates, la ville, la famille (âges, grossesse, chien…)
// et les idées déjà notées. Renvoie une proposition à valider avant de l'appliquer.
import { askAI } from './assistant.js';
import { getParty, describeParty } from './party.js';
import { tripDays, formatDay } from './dates.js';
import { ls } from '../core/config.js';
import { hasGoogle, searchPlaces } from './google.js';
import { searchAddress } from './places.js';
import { savePlace } from './trips.js';
import { store } from '../core/store.js';

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
${trip.arrivalTime ? `ARRIVÉE à l'hébergement le jour 1 à ${trip.arrivalTime} : aucune activité avant ${trip.arrivalTime} (prévois le temps de poser les valises), la première activité commence au plus tôt 30 à 60 min après, près de l'hébergement.\n` : 'Jour 1 = jour d’arrivée : commence tranquillement.\n'}${trip.departureTime ? `DÉPART le jour ${last} à ${trip.departureTime} : aucune activité après ${trip.departureTime} moins 1 h 30, rien de loin de l'hébergement ce jour-là.\n` : ''}Voyageurs : ${describeParty(party)}${ls.get('partyNotes', '') ? ` Notes : ${ls.get('partyNotes', '')}` : ''}
Idées déjà notées (réutilise-les en priorité avec leur id, surtout les favoris) : ${JSON.stringify(ideas).slice(0, 3000)}
Règles : rythme adapté au groupe (enfants, grossesse : pauses, pas de longues marches, une pause repos l'après-midi si besoin), 2 à 4 activités par jour regroupées par quartier pour limiter les trajets, premier et dernier jour plus légers (arrivée / départ), tiens compte des jours fériés, fermetures (lundi / mardi pour certains musées) et de la saison (activité couverte prévue en cas de pluie), un repas conseillé par jour adapté aux enfants (indique-le comme un lieu, catégorie restaurants).`;
}

function parsePlan(text, trip, places) {
  const days = tripDays(trip);
  const json = (text || '').replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}');
  let plan;
  try {
    plan = JSON.parse(json);
  } catch {
    throw new Error("L'IA a répondu dans un format inattendu, réessayez.");
  }
  if (!Array.isArray(plan.days) || !plan.days.length) throw new Error("L'IA n'a pas proposé de jours, réessayez.");
  const ids = new Set(places.map((p) => p.id));
  plan.days = plan.days
    .filter((d) => d.day >= 1 && d.day <= days.length)
    .map((d) => ({
      ...d,
      items: (d.items || [])
        .filter((i) => i?.name)
        .map((i) => ({ ...i, time: /^\d{1,2}:\d{2}$/.test(i.time || '') ? i.time.padStart(5, '0') : null, id: ids.has(i.id) ? i.id : null, category: CATS.includes(i.category) ? i.category : 'monuments' }))
        .sort((a, b) => (a.time || '99').localeCompare(b.time || '99')),
    }))
    .sort((a, b) => a.day - b.day);
  return plan;
}

export async function proposePlanning(trip, places, wishes = '') {
  const question = `Propose un planning de voyage jour par jour.
${context(trip, places)}
${wishes ? `Envies particulières : ${wishes}\n` : ''}Réponds UNIQUEMENT en JSON strict, sans texte autour :
${JSON_SHAPE}`;
  return parsePlan(await askAI({ question, system: SYSTEM, max: 2600 }), trip, places);
}

// Ajustement par petites demandes (« alléger le jour 2 », « Big Ben vers 17 h », « fish & chips mardi »…) :
// l'IA repart du planning actuel et ne modifie que ce qui est demandé.
export async function refinePlanning(trip, places, plan, request, history = []) {
  const compact = { days: plan.days.map((d) => ({ day: d.day, theme: d.theme, items: d.items.map(({ name, id, category, time, note }) => ({ name, id, category, time, note })) })), tips: plan.tips || [] };
  const question = `Voici le planning de voyage actuel, que la famille aime presque tel quel :
${JSON.stringify(compact)}
${context(trip, places)}
${history.length ? `Demandes déjà prises en compte (à conserver) : ${history.map((h) => `« ${h} »`).join(' ; ')}\n` : ''}NOUVELLE DEMANDE à appliquer : « ${request} »
Modifie UNIQUEMENT ce que la demande concerne (et ce qu'il faut décaler en conséquence, horaires compris). Garde tout le reste identique : mêmes lieux, mêmes jours, mêmes heures, mêmes id.
Réponds UNIQUEMENT avec le planning complet mis à jour, en JSON strict, sans texte autour :
${JSON_SHAPE}`;
  return parsePlan(await askAI({ question, system: SYSTEM, max: 3000 }), trip, places);
}

// Applique la proposition : les idées existantes sont placées dans leur jour, les nouveaux lieux
// sont cherchés (Google, sinon OpenStreetMap) puis ajoutés au jour.
export async function applyPlanning(trip, tripId, places, plan, memberId, onProgress, { unplanMissing = false } = {}) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const near = trip.lodging || trip.city;
  const total = plan.days.reduce((a, d) => a + d.items.length, 0);
  let done = 0;
  for (const d of plan.days) {
    let order = 0;
    for (const it of d.items) {
      const patch = { day: d.day, order: order++, time: it.time || null, aiNote: it.note || null };
      if (it.id && byId.has(it.id)) await savePlace(tripId, byId.get(it.id), patch);
      else {
        let found = null;
        try {
          if (hasGoogle()) found = (await searchPlaces(`${it.name} ${trip.city?.name || ''}`, near))[0] || null;
        } catch {
          found = null;
        }
        if (!found) {
          try {
            const r = (await searchAddress(it.name, trip.city))[0];
            if (r) found = { name: it.name, lat: r.lat, lon: r.lon, tags: { street: r.address?.split(',').slice(0, 2).join(',') || '' } };
          } catch {
            found = null;
          }
        }
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
