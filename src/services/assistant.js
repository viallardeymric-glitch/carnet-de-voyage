// Assistant de suggestions.
//  1) Mode « malin » sans IA : règles selon l'heure, la météo et les lieux proches.
//  2) Mode IA (optionnel) : Claude, si une clé API a été saisie dans Réglages.
import * as SecureStore from 'expo-secure-store';
import { CLAUDE_MODEL } from '../config/settings';
import { fetchPlaces } from './places';
import { distanceMeters, familyWalkMinutes } from './geo';

export const AI_KEY = 'claude_api_key';

export function momentOfDay(date = new Date()) {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 11.5) return 'matin';
  if (h < 14) return 'dejeuner';
  if (h < 16) return 'repos';
  if (h < 18.5) return 'fin-apres-midi';
  return 'soir';
}

const MOMENT_TEXT = {
  matin: 'C\'est le matin, le meilleur moment pour la grande visite du jour.',
  dejeuner: 'C\'est l\'heure de manger : voici des adresses tout près.',
  repos: 'Début d\'après-midi : place à une pause au calme pour Marie et la petite (sieste, hôtel ou parc tranquille).',
  'fin-apres-midi': 'Fin d\'après-midi : une activité douce et proche, sans longue marche.',
  soir: 'Soirée : dîner simple près de l\'hôtel et retour tôt.',
};

// Suggestions locales (aucune IA, fonctionne gratuitement).
export async function localSuggestions({ position, weather, ideas }) {
  const moment = momentOfDay();
  let category = 'loisirs';
  if (moment === 'dejeuner' || moment === 'soir') category = 'restaurants';
  else if (weather?.rainy || (weather?.temp != null && weather.temp < 6)) category = 'pluie';
  else if (moment === 'matin') category = 'musees';

  let nearby = [];
  try {
    nearby = await fetchPlaces(category, position, 1200, 60);
  } catch {
    nearby = [];
  }
  const ranked = nearby
    .map((p) => ({ ...p, distance: distanceMeters(position, p) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  const ideasNear = (ideas || [])
    .filter((p) => p.lat != null && p.day == null)
    .map((p) => ({ ...p, distance: distanceMeters(position, p) }))
    .filter((p) => p.distance < 2500)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  const tips = [MOMENT_TEXT[moment]];
  if (weather?.rainy) tips.push('Il pleut : privilégiez les lieux couverts (filtre « Abri pluie »).');
  if (weather?.temp != null && weather.temp < 5) tips.push(`Il fait ${weather.temp}°C : bonnet et gants pour la petite, pauses au chaud.`);
  if (ideasNear.length) tips.push('Des idées de votre boîte à idées sont à moins de 30 min à pied.');

  return {
    tips,
    category,
    places: ranked.map((p) => ({ ...p, walk: familyWalkMinutes(p.distance) })),
    ideasNear: ideasNear.map((p) => ({ ...p, walk: familyWalkMinutes(p.distance) })),
  };
}

export async function getApiKey() {
  return SecureStore.getItemAsync(AI_KEY);
}

// Question libre à Claude avec le contexte du voyage.
export async function askClaude({ question, context }) {
  const key = await getApiKey();
  if (!key) throw new Error('Ajoutez une clé API Claude dans Réglages pour activer l\'IA.');
  const system =
    'Tu es un conseiller voyage chaleureux et rigoureux pour une famille : papa (Eymric), maman (Marie, enceinte, ' +
    'rythme doux, pas d\'effort intense, accès médical rapide) et leur fille de 5 ans. ' +
    'Réponds en français, en 5 à 8 lignes maximum, avec des suggestions concrètes, proches et adaptées à l\'heure et à la météo.';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: `Contexte : ${JSON.stringify(context)}\n\nQuestion : ${question}` }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Erreur ${res.status}`);
  return data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n') || '';
}
