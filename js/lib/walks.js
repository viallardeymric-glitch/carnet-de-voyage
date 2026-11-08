// Petites balades à pied proposées par l'IA, autour de ma position (ou de l'hébergement) :
// quand on ne sait pas quoi faire. Chaque balade est tracée à pied et suivie sur la carte.
import { askAI, hasAI, parseLooseJSON } from './assistant.js';
import { getParty, describeParty } from './party.js';
import { hasGoogle, searchPlaces } from './google.js';
import { searchAddress } from './places.js';
import { transitRoutes } from './transit.js';
import { distanceMeters, familyWalkMinutes } from './geo.js';
import { ls } from '../core/config.js';

export async function proposeWalks(trip, start, { weather, minutes = 60, fresh = false } = {}) {
  if (!hasAI()) throw new Error('Ajoutez une clé Gemini ou Groq dans Réglages pour les balades.');
  const day = new Date().toISOString().slice(0, 10);
  // Même balades toute la journée dans un rayon d'environ 500 m : réponse instantanée.
  const key = `walks:${day}:${(Math.round(start.lat * 200) / 200).toFixed(3)},${(Math.round(start.lon * 200) / 200).toFixed(3)}:${minutes}`;
  const hit = !fresh && ls.get(key);
  if (hit) return hit;
  const question = `Nous sommes à ${trip.city?.name} (${trip.city?.country}), au point « ${start.name} » (${start.lat.toFixed(5)}, ${start.lon.toFixed(5)}). Il est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${weather ? `, météo : ${weather.label} ${weather.temp}°C` : ''}.
Voyageurs : ${describeParty(getParty(trip))}
On n'a rien de prévu : propose 3${fresh ? ' NOUVELLES' : ''} petites balades à pied DIFFÉRENTES qui partent d'ici et y reviennent (boucle), d'environ ${minutes} min chacune à pas tranquille, faciles (enfant, poussette, grossesse : peu de dénivelé, des bancs). Sans visite payante : rues jolies, parcs, quais, marchés, places, vitrines, illuminations selon la saison, une aire de jeux ou un goûter en route.
Les étapes doivent être de VRAIS lieux précis et proches les uns des autres (moins de 1,2 km entre deux étapes), dans l'ordre de la boucle, 3 à 5 étapes.
Réponds UNIQUEMENT en JSON strict :
{"balades":[{"titre":"…","ambiance":"une phrase courte","duree_min":60,"etapes":[{"nom":"nom exact du lieu","info":"10 mots max"}],"pause":"où goûter / se poser","conseil":"astuce famille courte"}]}
Sois bref : phrases courtes.`;
  const text = await askAI({ question, system: 'Tu es un guide local qui connaît chaque rue. Tu ne proposes que des lieux réels et proches.', max: 1100, json: true, timeout: 30000, hedge: 8000, parse: (t) => (parseLooseJSON(t), t) });
  let j;
  try {
    j = parseLooseJSON(text);
  } catch {
    throw new Error("L'IA a répondu dans un format inattendu, réessayez.");
  }
  const list = (j.balades || []).filter((b) => b?.titre && b.etapes?.length).slice(0, 3);
  if (!list.length) throw new Error("L'IA n'a pas proposé de balade, réessayez.");
  ls.set(key, list);
  return list;
}

async function locate(name, near, city) {
  try {
    if (hasGoogle()) {
      const r = (await searchPlaces(`${name} ${city?.name || ''}`, near))[0];
      if (r) return r;
    }
  } catch {
    /* on tente OpenStreetMap */
  }
  try {
    const r = (await searchAddress(name, city))[0];
    if (r) return { name, lat: r.lat, lon: r.lon };
  } catch {
    /* introuvable */
  }
  return null;
}

// Place les étapes sur la carte et calcule le trajet à pied (Google), sinon des lignes droites.
export async function buildWalk(walk, start, city) {
  const key = `walkroute:${walk.titre}:${start.lat.toFixed(3)},${start.lon.toFixed(3)}`;
  const hit = ls.get(key);
  if (hit) return hit;
  // Toutes les étapes sont cherchées en même temps (bien plus rapide qu'une par une).
  const found = await Promise.all(walk.etapes.map((e) => locate(e.nom, start, city)));
  const stops = [];
  walk.etapes.forEach((e, i) => {
    const p = found[i];
    // Une étape introuvable ou trop loin (homonyme) est ignorée.
    if (p && distanceMeters(start, p) < 4000) stops.push({ name: p.name || e.nom, info: e.info || '', lat: p.lat, lon: p.lon });
  });
  if (!stops.length) throw new Error('Impossible de placer les étapes sur la carte.');
  const pts = [start, ...stops, start];
  const parts = await Promise.all(
    pts.slice(0, -1).map(async (a, i) => {
      const b = pts[i + 1];
      if (hasGoogle()) {
        try {
          const r = (await transitRoutes(a, b, null, 'WALK'))[0];
          const coords = r?.parts.flatMap((x) => x.coords || []);
          if (coords?.length > 1) return { type: 'walk', min: r.min, m: r.parts.reduce((s, x) => s + (x.m || 0), 0), coords };
        } catch {
          /* ligne droite ci-dessous */
        }
      }
      const m = distanceMeters(a, b);
      return { type: 'walk', min: familyWalkMinutes(m), m: Math.round(m * 1.25), coords: [[a.lon, a.lat], [b.lon, b.lat]] };
    })
  );
  const min = parts.reduce((s, x) => s + x.min, 0);
  const m = parts.reduce((s, x) => s + x.m, 0);
  const out = { route: { min, parts, walkOnly: true }, to: { name: start.name, lat: start.lat, lon: start.lon }, stops, title: walk.titre, km: m / 1000 };
  ls.set(key, out);
  return out;
}
