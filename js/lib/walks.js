// Petites balades à pied proposées par l'IA, autour de ma position (ou de l'hébergement) :
// quand on ne sait pas quoi faire. Chaque balade est tracée à pied et suivie sur la carte.
import { askAI, hasAI } from './assistant.js';
import { getParty, describeParty } from './party.js';
import { hasGoogle, searchPlaces } from './google.js';
import { searchAddress } from './places.js';
import { transitRoutes } from './transit.js';
import { distanceMeters, familyWalkMinutes } from './geo.js';
import { ls } from '../core/config.js';

export async function proposeWalks(trip, start, { weather, minutes = 60, fresh = false } = {}) {
  if (!hasAI()) throw new Error('Ajoutez une clé Gemini ou Groq dans Réglages pour les balades.');
  const day = new Date().toISOString().slice(0, 10);
  const key = `walks:${day}:${start.lat.toFixed(3)},${start.lon.toFixed(3)}:${minutes}`;
  const hit = !fresh && ls.get(key);
  if (hit) return hit;
  const question = `Nous sommes à ${trip.city?.name} (${trip.city?.country}), au point « ${start.name} » (${start.lat.toFixed(5)}, ${start.lon.toFixed(5)}). Il est ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${weather ? `, météo : ${weather.label} ${weather.temp}°C` : ''}.
Voyageurs : ${describeParty(getParty(trip))}
On n'a rien de prévu : propose 3${fresh ? ' NOUVELLES' : ''} petites balades à pied DIFFÉRENTES qui partent d'ici et y reviennent (boucle), d'environ ${minutes} min chacune à pas tranquille, faciles (enfant, poussette, grossesse : peu de dénivelé, des bancs). Sans visite payante : rues jolies, parcs, quais, marchés, places, vitrines, illuminations selon la saison, une aire de jeux ou un goûter en route.
Les étapes doivent être de VRAIS lieux précis et proches les uns des autres (moins de 1,2 km entre deux étapes), dans l'ordre de la boucle, 3 à 5 étapes.
Réponds UNIQUEMENT en JSON strict :
{"balades":[{"titre":"…","ambiance":"une phrase","duree_min":60,"etapes":[{"nom":"nom exact du lieu","info":"ce qu'on y voit, en une phrase"}],"pause":"où goûter / se poser","conseil":"astuce famille"}]}`;
  const text = await askAI({ question, system: 'Tu es un guide local qui connaît chaque rue. Tu ne proposes que des lieux réels et proches.', max: 1600 });
  let j;
  try {
    j = JSON.parse((text || '').replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}'));
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
  const stops = [];
  for (const e of walk.etapes) {
    const p = await locate(e.nom, start, city);
    // Une étape introuvable ou trop loin (homonyme) est ignorée.
    if (p && distanceMeters(start, p) < 4000) stops.push({ name: p.name || e.nom, info: e.info || '', lat: p.lat, lon: p.lon });
  }
  if (!stops.length) throw new Error('Impossible de placer les étapes sur la carte.');
  const pts = [start, ...stops, start];
  const parts = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    let seg = null;
    if (hasGoogle()) {
      try {
        const r = (await transitRoutes(a, b, null, 'WALK'))[0];
        const coords = r?.parts.flatMap((x) => x.coords || []);
        if (coords?.length > 1) seg = { type: 'walk', min: r.min, m: r.parts.reduce((s, x) => s + (x.m || 0), 0), coords };
      } catch {
        seg = null;
      }
    }
    if (!seg) {
      const m = distanceMeters(a, b);
      seg = { type: 'walk', min: familyWalkMinutes(m), m: Math.round(m * 1.25), coords: [[a.lon, a.lat], [b.lon, b.lat]] };
    }
    parts.push(seg);
  }
  const min = parts.reduce((s, x) => s + x.min, 0);
  const m = parts.reduce((s, x) => s + x.m, 0);
  return { route: { min, parts, walkOnly: true }, to: { name: start.name, lat: start.lat, lon: start.lon }, stops, title: walk.titre, km: m / 1000 };
}
