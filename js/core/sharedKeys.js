// Clés Google / IA partagées entre les deux téléphones via la synchronisation privée (Firestore,
// lisible uniquement par les deux comptes de la famille). Jamais dans le code public.
import { useEffect } from '../../vendor/preact.js';
import { store } from './store.js';
import { ls } from './config.js';

const NAMES = ['google', 'gemini', 'groq', 'claude'];
let currentPath = null;

function localKeys() {
  const ai = ls.get('ai_keys', {}) || {};
  return { google: ls.get('googleKey', null), gemini: ai.gemini || null, groq: ai.groq || null, claude: ai.claude || ls.get('claude_api_key', null) || null };
}
function setLocal(name, value) {
  if (name === 'google') return ls.set('googleKey', value || null);
  const ai = ls.get('ai_keys', {}) || {};
  if (value) ai[name] = value;
  else delete ai[name];
  ls.set('ai_keys', ai);
  if (name === 'claude' && !value) ls.set('claude_api_key', null);
}

// Appelé quand une clé est ajoutée, changée ou retirée dans Réglages.
export function pushKey(name, value) {
  if (currentPath) store.set(currentPath, { [name]: value || null, updatedAtMs: Date.now() }, true).catch(() => {});
}

export function useSharedKeys(mode, user, tripId) {
  useEffect(() => {
    if (mode !== 'firebase' || !user || !tripId) return undefined;
    const path = `trips/${tripId}/meta/keys`;
    currentPath = path;
    const unsub = store.subDoc(path, (remote) => {
      const local = localKeys();
      const patch = {};
      for (const n of NAMES) {
        const r = remote ? remote[n] : undefined;
        if (r === undefined) {
          if (local[n]) patch[n] = local[n]; // seulement ici → on partage
        } else if (r !== local[n]) setLocal(n, r); // l'autre téléphone a ajouté, changé ou retiré la clé
      }
      if (Object.keys(patch).length) store.set(path, { ...patch, updatedAtMs: Date.now() }, true).catch(() => {});
    });
    return () => {
      unsub?.();
      if (currentPath === path) currentPath = null;
    };
  }, [mode, user?.uid, tripId]);
}
