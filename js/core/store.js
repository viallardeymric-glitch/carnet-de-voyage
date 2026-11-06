// Données de l'app. Deux modes, même interface :
//  - « local »    : tout est enregistré sur ce téléphone (localStorage), sans compte.
//  - « firebase » : synchronisation en temps réel entre les deux iPhone (Firestore),
//                   avec cache hors-ligne IndexedDB.
import { useEffect, useState } from '../../vendor/preact.js';
import { ls, getFirebaseConfig } from './config.js';

let backend = null;
export let fb = null; // module Firebase chargé à la demande
export let auth = null;
let db = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const parent = (path) => path.split('/').slice(0, -1).join('/');
const last = (path) => path.split('/').pop();

// ---------------------------------------------------------------- local
function localBackend() {
  const KEY = 'db';
  let data = ls.get(KEY, {});
  const subs = new Map(); // path -> Set(cb)
  const save = () => ls.set(KEY, data);
  const coll = (path) => Object.entries(data[path] || {}).map(([id, v]) => ({ id, ...v }));
  const docOf = (path) => {
    const v = data[parent(path)]?.[last(path)];
    return v ? { id: last(path), ...v } : null;
  };
  const notify = (docPath) => {
    const c = parent(docPath);
    subs.get(c)?.forEach((cb) => cb(coll(c), false));
    subs.get(docPath)?.forEach((cb) => cb(docOf(docPath)));
  };
  const on = (path, cb) => {
    if (!subs.has(path)) subs.set(path, new Set());
    subs.get(path).add(cb);
    return () => subs.get(path).delete(cb);
  };
  const write = (docPath, value) => {
    const c = parent(docPath);
    data[c] = data[c] || {};
    if (value == null) delete data[c][last(docPath)];
    else data[c][last(docPath)] = value;
    save();
    notify(docPath);
  };
  return {
    mode: 'local',
    sub(path, cb) {
      cb(coll(path), false);
      return on(path, cb);
    },
    subDoc(path, cb) {
      cb(docOf(path));
      return on(path, cb);
    },
    async add(path, value) {
      const id = uid();
      write(`${path}/${id}`, value);
      return id;
    },
    async set(path, value, merge = false) {
      const prev = merge ? data[parent(path)]?.[last(path)] || {} : {};
      write(path, { ...prev, ...value });
    },
    async update(path, patch) {
      const prev = data[parent(path)]?.[last(path)];
      if (prev) write(path, { ...prev, ...patch });
    },
    async remove(path) {
      write(path, null);
    },
    exportAll: () => data,
  };
}

// ---------------------------------------------------------------- firebase
async function firebaseBackend(cfg) {
  fb = await import('../../vendor/firebase.js');
  const app = fb.getApps()[0] || fb.initializeApp(cfg);
  auth = fb.getAuth(app);
  try {
    db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentSingleTabManager() }) });
  } catch {
    db = fb.initializeFirestore(app, { localCache: fb.memoryLocalCache() });
  }
  const ref = (path) => fb.doc(db, path);
  return {
    mode: 'firebase',
    sub(path, cb) {
      return fb.onSnapshot(
        fb.collection(db, path),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })), snap.metadata.fromCache),
        (err) => console.warn('Firestore', path, err.message)
      );
    },
    subDoc(path, cb) {
      return fb.onSnapshot(
        ref(path),
        (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        (err) => console.warn('Firestore', path, err.message)
      );
    },
    async add(path, value) {
      // On génère l'id localement : l'écriture fonctionne aussi hors-ligne.
      const id = uid();
      fb.setDoc(ref(`${path}/${id}`), value).catch((e) => console.warn(e));
      return id;
    },
    async set(path, value, merge = false) {
      fb.setDoc(ref(path), value, { merge }).catch((e) => console.warn(e));
    },
    async update(path, patch) {
      fb.updateDoc(ref(path), patch).catch((e) => console.warn(e));
    },
    async remove(path) {
      fb.deleteDoc(ref(path)).catch((e) => console.warn(e));
    },
  };
}

export async function initStore() {
  const cfg = getFirebaseConfig();
  if (cfg) {
    try {
      backend = await firebaseBackend(cfg);
      return backend.mode;
    } catch (e) {
      console.warn('Firebase indisponible, passage en mode local', e);
    }
  }
  backend = localBackend();
  return backend.mode;
}

export const store = {
  get mode() {
    return backend?.mode;
  },
  sub: (...a) => backend.sub(...a),
  subDoc: (...a) => backend.subDoc(...a),
  add: (...a) => backend.add(...a),
  set: (...a) => backend.set(...a),
  update: (...a) => backend.update(...a),
  remove: (...a) => backend.remove(...a),
  exportAll: () => backend.exportAll?.(),
};

// ---------------------------------------------------------------- hooks
export function useCollection(path, sortFn) {
  const [state, setState] = useState({ items: [], loading: true, fromCache: false });
  useEffect(() => {
    if (!path) {
      setState({ items: [], loading: false, fromCache: false });
      return undefined;
    }
    return store.sub(path, (items, fromCache) => setState({ items, loading: false, fromCache }));
  }, [path]);
  return { ...state, items: sortFn ? [...state.items].sort(sortFn) : state.items };
}

export function useDoc(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!path) return undefined;
    return store.subDoc(path, setData);
  }, [path]);
  return data;
}
