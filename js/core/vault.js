// Coffre-fort : documents CHIFFRÉS (AES-256-GCM).
//  - Avec la synchronisation : coffre COMMUN aux deux téléphones. Les fichiers sont chiffrés sur le
//    téléphone avec une clé familiale (partagée uniquement entre vos deux comptes), puis découpés et
//    rangés dans votre base Firestore privée. Ils restent consultables hors-ligne une fois reçus.
//  - Sans synchronisation : coffre local (IndexedDB), clé non exportable.
import { store } from './store.js';
import { ls } from './config.js';
const DB = 'cdv-coffre';
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('docs', { keyPath: 'id' });
        req.result.createObjectStore('keys');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const r = fn(t.objectStore(store));
        t.oncomplete = () => resolve(r?.result);
        t.onerror = () => reject(t.error);
      })
  );
}

async function key() {
  let k = await tx('keys', 'readonly', (s) => s.get('main'));
  if (!k) {
    k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await tx('keys', 'readwrite', (s) => s.put(k, 'main'));
  }
  return k;
}

async function encrypt(buf) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), buf);
  return { iv, ct };
}
async function decrypt({ iv, ct }) {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await key(), ct);
}
const encJSON = (o) => encrypt(new TextEncoder().encode(JSON.stringify(o)));
const decJSON = async (e) => JSON.parse(new TextDecoder().decode(await decrypt(e)));

async function localList() {
  const rows = (await tx('docs', 'readonly', (s) => s.getAll())) || [];
  const out = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, hasFile: !!r.file, ...(await decJSON(r.meta)) });
    } catch (e) {
      console.warn('Document illisible', e);
    }
  }
  return out.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
}

async function localAddFile(file, { title, kind }) {
  const id = `${Date.now()}`;
  const meta = {
    title: title || file.name || 'Document',
    kind: kind || 'autre',
    mime: file.type,
    name: file.name,
    size: file.size,
    isPdf: file.type === 'application/pdf',
    isImage: file.type.startsWith('image/'),
    addedAt: new Date().toISOString(),
  };
  const record = { id, meta: await encJSON(meta), file: await encrypt(await file.arrayBuffer()) };
  await tx('docs', 'readwrite', (s) => s.put(record));
  return id;
}

async function localAddBooking(booking) {
  const id = `${Date.now()}`;
  const meta = { ...booking, addedAt: new Date().toISOString() };
  const record = { id, meta: await encJSON(meta) };
  await tx('docs', 'readwrite', (s) => s.put(record));
  return id;
}

async function localOpen(id) {
  const r = await tx('docs', 'readonly', (s) => s.get(id));
  const meta = await decJSON(r.meta);
  const buf = await decrypt(r.file);
  return URL.createObjectURL(new Blob([buf], { type: meta.mime || 'application/octet-stream' }));
}

const localRemove = (id) => tx('docs', 'readwrite', (s) => s.delete(id));

// Demande au navigateur de ne jamais effacer ces données.
export const persistStorage = () => navigator.storage?.persist?.().catch(() => false);

// ------------------------------------------------------------------ coffre commun (Firestore)
const CHUNK = 700000; // caractères base64 par document (limite Firestore : 1 Mo)
let shared = null; // { path, docs: Map }
const listeners = new Set();

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

// Clé familiale : générée une fois, partagée via la synchro privée (voir sharedKeys.js).
// Si les deux téléphones en ont créé une chacun au même moment, chaque téléphone garde toutes
// les clés qu'il a connues et re-chiffre ses documents avec la clé commune : rien n'est perdu.
const imported = new Map();
async function importKey(raw) {
  if (!imported.has(raw)) imported.set(raw, await crypto.subtle.importKey('raw', unb64(raw), 'AES-GCM', false, ['encrypt', 'decrypt']));
  return imported.get(raw);
}
async function kidOf(raw) {
  return b64(await crypto.subtle.digest('SHA-256', unb64(raw))).slice(0, 10);
}
function knownKeys() {
  const list = ls.get('vaultKeys', []) || [];
  const cur = ls.get('vaultKey', null);
  if (cur && !list.includes(cur)) {
    list.push(cur);
    ls.set('vaultKeys', list);
  }
  return list;
}
async function currentKey() {
  let raw = ls.get('vaultKey', null);
  if (!raw) {
    raw = b64(crypto.getRandomValues(new Uint8Array(32)));
    ls.set('vaultKey', raw);
    const { pushKey } = await import('./sharedKeys.js');
    pushKey('vaultKey', raw);
  }
  knownKeys();
  return { raw, kid: await kidOf(raw), key: await importKey(raw) };
}
async function keyForKid(kid) {
  for (const raw of knownKeys()) if ((await kidOf(raw)) === kid) return importKey(raw);
  return null;
}
async function sEnc(buf) {
  const { key } = await currentKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ct), 12);
  return b64(out);
}
async function sDec(str, kid) {
  const key = kid ? await keyForKid(kid) : (await currentKey()).key;
  if (!key) throw new Error('clé inconnue');
  const all = unb64(str);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, key, all.subarray(12));
}

// Photos trop lourdes : réduites (2000 px, JPEG) avant chiffrement.
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.size < 1500000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Branche le coffre commun sur la synchro (appelé par l'écran Coffre-fort).
export function useSharedVault(path) {
  if (!path) {
    shared = null;
    return () => {};
  }
  shared = { path, docs: new Map() };
  const unsub = store.sub(path, (items) => {
    if (!shared || shared.path !== path) return;
    shared.docs = new Map(items.map((d) => [d.id, d]));
    listeners.forEach((f) => f());
    migrateLocal();
  });
  return () => {
    unsub?.();
    if (shared?.path === path) shared = null;
  };
}
export const onVaultChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const isShared = () => !!shared;

async function sharedList() {
  const out = [];
  for (const d of shared.docs.values()) {
    if (d.type !== 'vault') continue;
    try {
      const meta = JSON.parse(new TextDecoder().decode(await sDec(d.meta, d.kid)));
      out.push({ id: d.id, hasFile: d.chunks > 0, ...meta });
      rekey(d);
    } catch {
      out.push({ id: d.id, title: 'Document (clé manquante)', kind: 'autre', locked: true });
    }
  }
  return out.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
}

async function sharedPut(meta, buf, id = `v${Date.now()}${Math.random().toString(36).slice(2, 6)}`) {
  const { kid } = await currentKey();
  let chunks = 0;
  if (buf) {
    const data = await sEnc(buf);
    for (let i = 0; i * CHUNK < data.length; i++) {
      await store.set(`${shared.path}/${id}_c${i}`, { type: 'vchunk', of: id, i, kid, data: data.slice(i * CHUNK, (i + 1) * CHUNK) });
      chunks++;
    }
  }
  await store.set(`${shared.path}/${id}`, { type: 'vault', kid, meta: await sEnc(new TextEncoder().encode(JSON.stringify(meta))), chunks, addedAtMs: Date.now() });
  return id;
}

async function readFile(d) {
  let data = '';
  for (let i = 0; i < d.chunks; i++) {
    const c = shared.docs.get(`${d.id}_c${i}`);
    if (!c) throw new Error('Document pas encore reçu : réessayez avec du réseau.');
    data += c.data;
  }
  return d.chunks ? sDec(data, d.kid) : null;
}

// Document chiffré avec une ancienne clé de ce téléphone → re-chiffré avec la clé commune.
const rekeying = new Set();
async function rekey(d) {
  try {
    const { kid } = await currentKey();
    if (!d.kid || d.kid === kid || rekeying.has(d.id)) return;
    rekeying.add(d.id);
    const meta = JSON.parse(new TextDecoder().decode(await sDec(d.meta, d.kid)));
    const buf = await readFile(d);
    await sharedPut(meta, buf, d.id);
  } catch (e) {
    console.warn('rechiffrement', e);
  }
}

async function sharedOpen(id) {
  const d = shared.docs.get(id);
  const meta = JSON.parse(new TextDecoder().decode(await sDec(d.meta, d.kid)));
  const buf = await readFile(d);
  return URL.createObjectURL(new Blob([buf], { type: meta.mime || 'application/octet-stream' }));
}

async function sharedRemove(id) {
  const d = shared.docs.get(id);
  for (let i = 0; i < (d?.chunks || 0); i++) await store.remove(`${shared.path}/${id}_c${i}`);
  await store.remove(`${shared.path}/${id}`);
}

// Les documents déjà rangés dans le coffre local de ce téléphone passent dans le coffre commun.
let migrating = false;
async function migrateLocal() {
  if (migrating || !shared || ls.get('vaultMigrated', false)) return;
  migrating = true;
  try {
    const rows = (await tx('docs', 'readonly', (s) => s.getAll())) || [];
    for (const r of rows) {
      const meta = await decJSON(r.meta);
      const buf = r.file ? await decrypt(r.file) : null;
      await sharedPut(meta, buf);
      await localRemove(r.id);
    }
    ls.set('vaultMigrated', true);
  } catch (e) {
    console.warn('migration coffre', e);
  }
  migrating = false;
}

// ------------------------------------------------------------------ API utilisée par l'écran
export const listDocs = () => (shared ? sharedList() : localList());
export async function addFile(file, { title, kind }) {
  if (!shared) return localAddFile(file, { title, kind });
  const f = await shrink(file);
  const meta = {
    title: title || file.name || 'Document',
    kind: kind || 'autre',
    mime: f.type,
    name: f.name,
    size: f.size,
    isPdf: f.type === 'application/pdf',
    isImage: f.type.startsWith('image/'),
    addedAt: new Date().toISOString(),
  };
  if (f.size > 9 * 1024 * 1024) throw new Error('Fichier trop lourd (9 Mo maximum).');
  return sharedPut(meta, await f.arrayBuffer());
}
export const addBooking = (booking) => (shared ? sharedPut({ ...booking, addedAt: new Date().toISOString() }, null) : localAddBooking(booking));
export const openFile = (id) => (shared ? sharedOpen(id) : localOpen(id));
export const removeDoc = (id) => (shared ? sharedRemove(id) : localRemove(id));
