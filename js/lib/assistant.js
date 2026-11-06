// Assistant de suggestions.
//  1) Mode « malin » sans IA : règles selon l'heure, la météo et les lieux proches.
//  2) Mode IA (optionnel) : Gemini, Groq ou Claude, selon les clés saisies dans Réglages.
import { CLAUDE_MODEL, ls } from '../core/config.js';
import { fetchPlaces } from './places.js';
import { distanceMeters, familyWalkMinutes } from './geo.js';

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
  repos: 'Début d\'après-midi : place à une pause au calme (sieste, hôtel ou parc tranquille).',
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
  if (weather?.temp != null && weather.temp < 5) tips.push(`Il fait ${weather.temp}°C : bonnet et gants pour tout le monde, pauses au chaud.`);
  if (ideasNear.length) tips.push('Des idées de votre boîte à idées sont à moins de 30 min à pied.');

  return {
    tips,
    category,
    places: ranked.map((p) => ({ ...p, walk: familyWalkMinutes(p.distance) })),
    ideasNear: ideasNear.map((p) => ({ ...p, walk: familyWalkMinutes(p.distance) })),
  };
}

// Clés IA enregistrées sur ce téléphone : { gemini, groq, claude }. Gemini et Groq ont une offre gratuite.
export const AI_PROVIDERS = [
  { id: 'gemini', label: 'Gemini (Google)', hint: 'Gratuit : aistudio.google.com › Get API key', placeholder: 'AIza…' },
  { id: 'groq', label: 'Groq', hint: 'Gratuit : console.groq.com › API Keys', placeholder: 'gsk_…' },
  { id: 'claude', label: 'Claude', hint: 'Payant : console.anthropic.com', placeholder: 'sk-ant-…' },
];
export function getAiKeys() {
  const keys = ls.get('ai_keys', {}) || {};
  const legacy = ls.get(AI_KEY);
  if (legacy && !keys.claude) keys.claude = legacy;
  return keys;
}
export function setAiKey(provider, key) {
  const keys = getAiKeys();
  if (key) keys[provider] = key;
  else delete keys[provider];
  ls.set('ai_keys', keys);
  if (provider === 'claude' && !key) ls.set(AI_KEY, null);
}
export const getApiKey = () => Object.values(getAiKeys()).find(Boolean) || null;
export const setApiKey = (k) => setAiKey('claude', k);

const SYSTEM_BASE =
  'Tu es un conseiller voyage chaleureux et rigoureux. ' +
  "Réponds en français, en 5 à 8 lignes maximum, avec des suggestions concrètes, proches et adaptées à l'heure, à la météo et au groupe.";
const SYSTEM = SYSTEM_BASE;
export const assistantSystem = (partyText) => `${SYSTEM_BASE} ${partyText || ''}`;

async function readError(res) {
  const d = await res.json().catch(() => ({}));
  return new Error(d?.error?.message || `Erreur ${res.status}`);
}

async function viaGemini(key, prompt, { system = SYSTEM, max = 800 } = {}) {
  let last;
  for (const model of ['gemini-flash-latest', 'gemini-2.5-flash']) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: max + 2000, temperature: 0.6 },
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
    }
    last = await readError(res);
    if (res.status !== 404) break;
  }
  throw last;
}

async function viaGroq(key, prompt, { system = SYSTEM, max = 800 } = {}) {
  let last;
  for (const model of ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: max,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (res.ok) return (await res.json()).choices?.[0]?.message?.content || '';
    last = await readError(res);
    if (res.status !== 404 && res.status !== 400) break;
  }
  throw last;
}

async function viaClaude(key, prompt, { system = SYSTEM, max = 800 } = {}) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: max, system, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw await readError(res);
  const data = await res.json();
  return data.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n') || '';
}

// Question libre avec le contexte du voyage : Gemini, puis Groq, puis Claude (le suivant prend le relais
// si le premier est indisponible ou a atteint son quota gratuit).
export const hasAI = () => Object.values(getAiKeys()).some(Boolean);

export async function askAI({ question, context, system, max }) {
  const keys = getAiKeys();
  const order = [
    ['gemini', viaGemini],
    ['groq', viaGroq],
    ['claude', viaClaude],
  ].filter(([id]) => keys[id]);
  if (!order.length) throw new Error("Ajoutez une clé Gemini ou Groq (gratuites) dans Réglages pour activer l'IA.");
  const prompt = context ? `Contexte : ${JSON.stringify(context)}\n\nQuestion : ${question}` : question;
  let last;
  for (const [id, fn] of order) {
    try {
      return await fn(keys[id], prompt, { system: system || SYSTEM, max: max || 800 });
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
export const askClaude = askAI;
