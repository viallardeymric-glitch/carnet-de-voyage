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

export async function proposePlanning(trip, places, wishes = '') {
  const days = tripDays(trip);
  const party = getParty(trip);
  const ideas = places.map((p) => ({ id: p.id, nom: p.name, cat: p.category, jour: p.day || null, favori: !!p.favorite }));
  const question = `Propose un planning de voyage jour par jour.
Destination : ${trip.city?.name} (${trip.city?.country}). Hébergement : ${trip.lodging?.name || 'non choisi'}${trip.lodging?.address ? `, ${trip.lodging.address}` : ''}.
Jours : ${days.map((d) => `Jour ${d.index} = ${formatDay(d.iso)} ${d.iso}`).join(' ; ')}.
Voyageurs : ${describeParty(party)}${ls.get('partyNotes', '') ? ` Notes : ${ls.get('partyNotes', '')}` : ''}
${wishes ? `Envies particulières : ${wishes}\n` : ''}Idées déjà notées (réutilise-les en priorité avec leur id, surtout les favoris) : ${JSON.stringify(ideas).slice(0, 3000)}
Règles : rythme adapté au groupe (enfants, grossesse : pauses, pas de longues marches, une pause repos l'après-midi si besoin), 2 à 4 activités par jour regroupées par quartier pour limiter les trajets, premier et dernier jour plus légers (arrivée / départ), tiens compte des jours fériés, fermetures (lundi / mardi pour certains musées) et de la saison (activité couverte prévue en cas de pluie), un repas conseillé par jour adapté aux enfants.
Réponds UNIQUEMENT en JSON strict, sans texte autour :
{"days":[{"day":1,"theme":"titre court du jour","items":[{"name":"nom exact du lieu","id":"id de l'idée ou null","category":"${CATS.join('|')}","time":"10:00","note":"conseil court pour la famille"}]}],"tips":["3 conseils généraux maximum"]}`;
  const text = await askAI({ question, system: 'Tu es un organisateur de voyages en famille, précis et réaliste. Tu ne proposes que des lieux qui existent vraiment.', max: 2600 });
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
    .map((d) => ({ ...d, items: (d.items || []).filter((i) => i?.name).map((i) => ({ ...i, id: ids.has(i.id) ? i.id : null, category: CATS.includes(i.category) ? i.category : 'monuments' })) }));
  return plan;
}

// Applique la proposition : les idées existantes sont placées dans leur jour, les nouveaux lieux
// sont cherchés (Google, sinon OpenStreetMap) puis ajoutés au jour.
export async function applyPlanning(trip, tripId, places, plan, memberId, onProgress) {
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
  await store.update(`trips/${tripId}`, { dayThemes: Object.fromEntries(plan.days.map((d) => [d.day, d.theme || ''])), aiTips: plan.tips || [] });
}
