// Réglages et configuration conservés sur l'appareil (localStorage).
const P = 'cdv::';
export const ls = {
  get(k, def = null) {
    try {
      const v = localStorage.getItem(P + k);
      return v == null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      if (v == null) localStorage.removeItem(P + k);
      else localStorage.setItem(P + k, JSON.stringify(v));
    } catch (e) {
      console.warn(e);
    }
  },
};

export const DEFAULT_MEMBERS = {
  E: { id: 'E', name: 'Eymric', color: '#1E6FD9', email: '' },
  M: { id: 'M', name: 'Marie', color: '#E2508C', email: '' },
};

export function getMembers() {
  const saved = ls.get('members', {});
  return {
    E: { ...DEFAULT_MEMBERS.E, ...(saved.E || {}) },
    M: { ...DEFAULT_MEMBERS.M, ...(saved.M || {}) },
  };
}
export const setMembers = (m) => ls.set('members', m);
export const otherMember = (id) => (id === 'E' ? 'M' : 'E');

export const AUTO_LOCK_SECONDS = 60;
export const FAMILY_WALK_KMH = 3;
export const CLAUDE_MODEL = 'claude-haiku-5-5';
export const USER_AGENT = 'CarnetDeVoyageFamille/1.0 (app personnelle)';

// Configuration Firebase collée par l'utilisateur (même principe que l'app Budget).
// Accepte le bloc complet « const firebaseConfig = { apiKey: "…", … }; ».
export function parseFirebaseConfig(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Bloc { … } introuvable');
  const json = m[0]
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/,\s*}/g, '}');
  const cfg = JSON.parse(json);
  if (!cfg.apiKey || !cfg.projectId) throw new Error('apiKey ou projectId manquant');
  return cfg;
}
export const getFirebaseConfig = () => ls.get('firebase');
export const setFirebaseConfig = (cfg) => ls.set('firebase', cfg);

// Lien d'invitation : transmet la configuration Firebase et les prénoms à l'autre téléphone.
export function inviteLink() {
  const payload = { firebase: getFirebaseConfig(), members: getMembers() };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return `${location.origin}${location.pathname}#invite=${b64}`;
}
export function consumeInvite() {
  const m = location.hash.match(/#invite=([^&]+)/);
  if (!m) return false;
  try {
    const payload = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (payload.firebase) setFirebaseConfig(payload.firebase);
    if (payload.members) setMembers(payload.members);
    history.replaceState(null, '', location.pathname);
    return true;
  } catch {
    return false;
  }
}
