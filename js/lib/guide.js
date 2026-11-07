// Guide de visite rédigé par l'IA (Gemini / Groq / Claude) pour les lieux qui se visitent,
// adapté à la famille. Gardé sur le téléphone : une seule génération par lieu.
import { ls } from '../core/config.js';
import { askAI, hasAI } from './assistant.js';
import { photoKey } from './photos.js';
import { describeParty, guideSections, partyKey } from './party.js';

export const VISITABLE = ['monuments', 'musees', 'loisirs', 'pluie', 'shopping'];
// Lieux qui ont un guide : tout sauf les adresses purement pratiques (distributeur, pharmacie…).
export const hasGuideFor = (place) => !!place && (place.isLodging || !['pratique', 'sante'].includes(place.category));
const guideKind = (place) => (place.isLodging || place.category === 'hebergement' ? 'lodging' : place.category === 'restaurants' ? 'food' : 'visit');
export const guideTitle = (place) => ({ lodging: 'Guide du séjour', food: 'Guide du restaurant', visit: 'Guide de visite' })[guideKind(place)];

const system = (party, month) =>
  "Tu es un guide touristique expert et chaleureux. Tu écris en français, de façon précise et vivante, sans inventer : " +
  `si tu n'es pas sûr d'un prix ou d'un horaire, dis « à vérifier ». ${describeParty(party)}${month ? ` Voyage en ${month}.` : ''}`;

export const hasGuide = () => hasAI();
export const cachedGuide = (place, party) => ls.get(`guide:${photoKey(place)}:${partyKey(party)}`)?.text || null;

export async function writeGuide(place, { city, wiki, summary, kind, party, month, reviews }, force = false) {
  const key = `guide:${photoKey(place)}:${partyKey(party)}`;
  if (!force) {
    const hit = ls.get(key);
    if (hit?.text) return hit.text;
  }
  const ctx = `${summary ? `Résumé Google : ${summary}\n` : ''}${wiki ? `Extrait Wikipédia : ${wiki.slice(0, 1800)}\n` : ''}${reviews ? `Extraits d'avis de visiteurs : ${reviews.slice(0, 1500)}\n` : ''}`;
  const where = `« ${place.name} »${city ? ` à ${city}` : ''}${kind ? ` (${kind})` : ''}`;
  const fmt = 'Réponds exactement avec ces rubriques (titres précédés de « ## », listes avec « - », 3 à 5 points par liste, phrases courtes) :';
  const fam = guideSections(party);
  const t = guideKind(place);
  const question =
    t === 'lodging'
      ? `Rédige le guide de séjour de notre hébergement ${where}.\n${ctx}${fmt}
## L'essentiel
(2 ou 3 phrases : le lieu, son ambiance, ce qui en fait l'intérêt)
## Les plus du lieu
(équipements, piscine, espaces enfants, services : seulement ce qui est connu)
${fam}
## Autour, à pied
(plage, commerces, balades, ce qui est proche)
## Infos pratiques
(- Arrivée / départ : … - Parking : … - Courses : … - À savoir : …)`
      : t === 'food'
        ? `Rédige un guide de ${where}.\n${ctx}${fmt}
## L'essentiel
(2 ou 3 phrases : le style de cuisine, l'ambiance, la réputation)
## À goûter
(spécialités ou plats recommandés par les clients)
${fam}
## Infos pratiques
(- Budget : … - Réservation : … - Affluence : … - À savoir : …)`
        : `Rédige le guide de visite de ${where}.\n${ctx}${fmt}
## L'essentiel
(2 ou 3 phrases : ce que c'est, pourquoi c'est célèbre, une anecdote marquante)
## À ne pas manquer
${fam}
## Infos pratiques
(- Durée conseillée : … - Prix : … - Meilleur moment : … - Réservation : …)`;
  const text = await askAI({ question, system: system(party, month), max: 1100 });
  if (text) ls.set(key, { text, at: Date.now() });
  return text;
}
