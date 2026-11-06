// Guide de visite rédigé par l'IA (Gemini / Groq / Claude) pour les lieux qui se visitent,
// adapté à la famille. Gardé sur le téléphone : une seule génération par lieu.
import { ls } from '../core/config.js';
import { askAI, hasAI } from './assistant.js';
import { photoKey } from './photos.js';

export const VISITABLE = ['monuments', 'musees', 'loisirs', 'pluie', 'shopping'];

const SYSTEM =
  "Tu es un guide touristique expert et chaleureux. Tu écris en français, de façon précise et vivante, sans inventer : " +
  "si tu n'es pas sûr d'un prix ou d'un horaire, dis « à vérifier ». La famille : un papa, une maman enceinte (rythme doux, " +
  "pas de longue station debout, besoin de pauses et de toilettes) et une petite fille de 5 ans. Voyage en décembre.";

export const hasGuide = () => hasAI();
export const cachedGuide = (place) => ls.get(`guide:${photoKey(place)}`)?.text || null;

export async function writeGuide(place, { city, wiki, summary, kind }, force = false) {
  const key = `guide:${photoKey(place)}`;
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
## Avec votre fille de 5 ans
## Confort pour Marie
(ascenseurs, assises, cafés, toilettes, zones calmes, ce qui est fatigant à éviter)
## Infos pratiques
(- Durée conseillée : … - Prix : … - Meilleur moment : … - Réservation : …)`;
  const text = await askAI({ question, system: SYSTEM, max: 1100 });
  if (text) ls.set(key, { text, at: Date.now() });
  return text;
}
