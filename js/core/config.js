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
  const t = String(text || '');
  // On vise le bloc « firebaseConfig = { … } » (le texte copié contient aussi des import { … }).
  const m = t.match(/firebaseConfig\s*=\s*(\{[\s\S]*?\})/)?.slice(1) || t.match(/\{[^{}]*apiKey[^{}]*\}/);
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
// Configuration de la famille (valeurs publiques par nature : la sécurité vient
// des règles Firestore, qui n'autorisent que vos deux adresses email).
export const DEFAULT_FIREBASE = {
  apiKey: 'AIzaSyDMxdEL2VVZEvyXe4ug6CJIDT3W8z_Fc_w',
  authDomain: 'carnet-de-voyage-d6532.firebaseapp.com',
  projectId: 'carnet-de-voyage-d6532',
  storageBucket: 'carnet-de-voyage-d6532.firebasestorage.app',
  messagingSenderId: '383044044934',
  appId: '1:383044044934:web:12d908998e797d509e6907',
};

// null dans le stockage = valeur par défaut ; false = synchronisation désactivée sur ce téléphone.
export function getFirebaseConfig() {
  const v = ls.get('firebase');
  if (v === false) return null;
  return v || DEFAULT_FIREBASE;
}
export const setFirebaseConfig = (cfg) => ls.set('firebase', cfg || false);

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

// Apparence : thème de couleurs + clair / sombre / automatique.
export const THEMES = [
  { id: 'lagon', label: 'Lagon', colors: ['#0E9AA7', '#38D3C0'] },
  { id: 'rose', label: 'Rose', colors: ['#E0457B', '#FF8DB4'] },
  { id: 'soleil', label: 'Soleil', colors: ['#EF5B5B', '#FF9A56'] },
  { id: 'marine', label: 'Marine', colors: ['#0B3D63', '#1B7FC0'] },
];
export function applyAppearance() {
  // Lagon devient le thème de base (une seule fois : un choix fait ensuite est respecté).
  if (ls.get('themeV', 0) < 2) {
    ls.set('theme', 'lagon');
    ls.set('themeV', 2);
  }
  const theme = ls.get('theme', 'lagon');
  const scheme = ls.get('scheme', 'auto');
  const dark = scheme === 'dark' || (scheme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const el = document.documentElement;
  el.dataset.theme = theme;
  if (dark) el.dataset.dark = '1';
  else delete el.dataset.dark;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#000000' : '#FFFFFF');
}
export function watchAppearance() {
  applyAppearance();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyAppearance);
}
