// Assistant de suggestions.
//  1) Mode « malin » sans IA : règles selon l'heure, la météo et les lieux proches.
//  2) Mode IA (optionnel) : Gemini, Groq ou Claude, selon les clés saisies dans Réglages.
import { CLAUDE_MODEL, ls } from '../core/config.js';
import { fetchPlaces } from './places.js';
import { hasGoogle, nearbyGoogle } from './google.js';
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
    const job = hasGoogle() ? nearbyGoogle(category, position, 1200).catch(() => fetchPlaces(category, position, 1200, 60)) : fetchPlaces(category, position, 1200, 60);
    nearby = await Promise.race([job, new Promise((_, no) => setTimeout(() => no(new Error('lent')), 12000))]);
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

// Délai maximum par fournisseur : passé ce temps, on passe au suivant au lieu de tourner sans fin.
const timed = (ms) => {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
};
const AI_TIMEOUT = 25000;

// Lit le JSON renvoyé par l'IA, même entouré de texte ou coupé en plein milieu (réponse trop longue) :
// on garde tout ce qui est complet et on referme proprement.
export function parseLooseJSON(text) {
  const t = String(text || '').replace(/```(?:json)?/gi, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no-json');
  const body = t.slice(start);
  try {
    return JSON.parse(body.slice(0, body.lastIndexOf('}') + 1));
  } catch {
    /* réparation ci-dessous */
  }
  const stack = [];
  let inStr = false;
  let esc = false;
  let cut = -1;
  let cutStack = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') {
      stack.pop();
      cut = i + 1;
      cutStack = [...stack];
      if (!stack.length) break;
    }
  }
  if (cut < 0) throw new Error('no-json');
  const closers = (cutStack || []).reverse().map((c) => (c === '{' ? '}' : ']')).join('');
  return JSON.parse(body.slice(0, cut).replace(/,\s*$/, '') + closers);
}

async function readError(res) {
  const d = await res.json().catch(() => ({}));
  if (res.status === 429) return new Error('Limite gratuite de l’IA atteinte pour le moment : réessayez dans une minute.');
  if (res.status >= 500) return new Error('Le service d’IA est surchargé : réessayez dans un instant.');
  if (res.status === 401 || res.status === 403) return new Error('Clé IA refusée : vérifiez-la dans Réglages.');
  return new Error(d?.error?.message || `Erreur ${res.status}`);
}

async function viaGemini(key, prompt, { system = SYSTEM, max = 800, json = false, timeout = AI_TIMEOUT } = {}) {
  let last;
  for (const model of ['gemini-2.5-flash', 'gemini-flash-latest']) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: timed(timeout),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: max + 2000, temperature: 0.6, ...(json ? { responseMimeType: 'application/json' } : {}), ...(model === 'gemini-2.5-flash' ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
      }),
    });
    if (res.ok) {
      const d = await res.json();
      return d.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') || '';
    }
    last = await readError(res);
    if (res.status !== 404 && !(res.status === 400 && model === 'gemini-2.5-flash')) break;
  }
  throw last;
}

async function viaGroq(key, prompt, { system = SYSTEM, max = 800, json = false, timeout = AI_TIMEOUT } = {}) {
  let last;
  for (const model of ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: timed(timeout),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        // gpt-oss « réfléchit » avant de répondre : effort bas = réponse rapide, et de la marge
        // pour que la réflexion ne mange pas la réponse (sinon réponse vide).
        ...(model.startsWith('openai/') ? { reasoning_effort: 'low', max_tokens: max + 1500 } : { max_tokens: max }),
        ...(json ? { response_format: { type: 'json_object' } } : {}),
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

async function viaClaude(key, prompt, { system = SYSTEM, max = 800, timeout = AI_TIMEOUT } = {}) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: timed(timeout),
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

// parse : si la réponse d'un fournisseur est illisible, on essaie le suivant (au lieu d'échouer).
// Rapidité : si le premier fournisseur tarde (hedge), le suivant est lancé en parallèle et la
// première réponse valable gagne. Une réponse vide compte comme un échec.
export async function askAI({ question, context, system, max, json = false, parse = null, timeout = AI_TIMEOUT, hedge }) {
  const keys = getAiKeys();
  const order = [
    ['gemini', viaGemini],
    ['groq', viaGroq],
    ['claude', viaClaude],
  ].filter(([id]) => keys[id]);
  if (!order.length) throw new Error("Ajoutez une clé Gemini ou Groq (gratuites) dans Réglages pour activer l'IA.");
  const prompt = context ? `Contexte : ${JSON.stringify(context)}\n\nQuestion : ${question}` : question;
  const wait = hedge ?? ((max || 800) > 2000 ? 25000 : 9000);
  return new Promise((resolve, reject) => {
    let next = 0;
    let running = 0;
    let done = false;
    let last = null;
    let timer = null;
    const launch = () => {
      if (done || next >= order.length) return;
      const [id, fn] = order[next++];
      running++;
      clearTimeout(timer);
      timer = setTimeout(launch, wait); // trop lent : on lance aussi le suivant
      fn(keys[id], prompt, { system: system || SYSTEM, max: max || 800, json, timeout })
        .then((text) => {
          if (!String(text || '').trim()) throw new Error(`${id} : réponse vide`);
          return parse ? parse(text) : text;
        })
        .then((out) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(out);
        })
        .catch((e) => {
          last = e.name === 'AbortError' ? new Error(`${id} ne répond pas (réseau lent ?). Réessayez.`) : e;
          running--;
          if (done) return;
          if (next < order.length) launch(); // échec : le suivant tout de suite
          else if (!running) {
            done = true;
            clearTimeout(timer);
            reject(last);
          }
        });
    };
    launch();
  });
}
export const askClaude = askAI;
