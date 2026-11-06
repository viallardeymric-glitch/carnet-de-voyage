// Coffre-fort : documents CHIFFRÉS (AES-256-GCM) et stockés uniquement sur ce téléphone
// (IndexedDB). La clé est générée sur l'appareil et marquée non exportable.
// Rien n'est envoyé sur Internet ; tout reste consultable hors-ligne.
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

export async function listDocs() {
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

export async function addFile(file, { title, kind }) {
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

export async function addBooking(booking) {
  const id = `${Date.now()}`;
  const meta = { ...booking, addedAt: new Date().toISOString() };
  const record = { id, meta: await encJSON(meta) };
  await tx('docs', 'readwrite', (s) => s.put(record));
  return id;
}

export async function openFile(id) {
  const r = await tx('docs', 'readonly', (s) => s.get(id));
  const meta = await decJSON(r.meta);
  const buf = await decrypt(r.file);
  return URL.createObjectURL(new Blob([buf], { type: meta.mime || 'application/octet-stream' }));
}

export const removeDoc = (id) => tx('docs', 'readwrite', (s) => s.delete(id));

// Demande au navigateur de ne jamais effacer ces données.
export const persistStorage = () => navigator.storage?.persist?.().catch(() => false);
