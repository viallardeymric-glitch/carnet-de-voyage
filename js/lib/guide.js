// Guide de visite rédigé par l'IA (Gemini / Groq / Claude) pour les lieux qui se visitent,
// adapté à la famille. Gardé sur le téléphone : une seule génération par lieu.
import { ls } from '../core/config.js';
import { askAI, hasAI } from './assistant.js';
import { photoKey } from './photos.js';
import { describeParty, guideSections, partyKey } from './party.js';

export const VISITABLE = ['monuments', 'musees', 'loisirs', 'pluie', 'shopping'];

const system = (party, month) =>
  "Tu es un guide touristique expert et chaleureux. Tu écris en français, de façon précise et vivante, sans inventer : " +
  `si tu n'es pas sûr d'un prix ou d'un horaire, dis « à vérifier ». ${describeParty(party)}${month ? ` Voyage en ${month}.` : ''}`;

export const hasGuide = () => hasAI();
export const cachedGuide = (place, party) => ls.get(`guide:${photoKey(place)}:${partyKey(party)}`)?.text || null;

export async function writeGuide(place, { city, wiki, summary, kind, party, month }, force = false) {
  const key = `guide:${photoKey(place)}:${partyKey(party)}`;
  if (!force) {
    const hit = ls.get(key);
    if (hit?.text) return hit.text;
  }
  const question = `Rédige le guide de visite de « ${place.name} »${city ? ` à ${city}` : ''}${kind ? ` (${kind})` : ''}.
${summary ? `Résumé Google : ${summary}\n` : ''}${wiki ? `Extrait Wikipédia : ${wiki.slice(0, 1800)}\n` : ''}
Réponds exactement avec ces rubriques (titres précédés de « ## », listes avec « - », 3 à 5 points par liste, phrases courtes) :
## L'essentiel
(2 ou 3 phrases : ce que c'est, pourquoi c'est célèbre, une anecdote marquante)
## À ne pas manquer
${guideSections(party)}
## Infos pratiques
(- Durée conseillée : … - Prix : … - Meilleur moment : … - Réservation : …)`;
  const text = await askAI({ question, system: system(party, month), max: 1100 });
  if (text) ls.set(key, { text, at: Date.now() });
  return text;
}
