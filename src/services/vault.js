// Coffre-fort : les documents restent UNIQUEMENT sur le téléphone, dans l'espace
// privé de l'app (chiffré par iOS tant que l'iPhone est verrouillé).
// Ils ne sont jamais envoyés sur Internet et restent lisibles hors-ligne.
import { File, Directory, Paths } from 'expo-file-system';

const dir = () => new Directory(Paths.document, 'coffre-fort');
const indexFile = () => new File(dir(), 'index.json');

function ensureDir() {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
}

export async function listDocs() {
  ensureDir();
  const f = indexFile();
  if (!f.exists) return [];
  try {
    return JSON.parse(await f.text());
  } catch {
    return [];
  }
}

async function saveIndex(docs) {
  ensureDir();
  const f = indexFile();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(docs));
}

// Copie un fichier (photo, PDF) dans le coffre et l'ajoute à l'index.
export async function addFile({ uri, name, mimeType, title, kind }) {
  ensureDir();
  const ext = (name?.split('.').pop() || (mimeType?.includes('pdf') ? 'pdf' : 'jpg')).toLowerCase();
  const id = `${Date.now()}`;
  const dest = new File(dir(), `${id}.${ext}`);
  await new File(uri).copy(dest);
  const docs = await listDocs();
  const entry = {
    id,
    title: title || name || 'Document',
    kind: kind || 'autre',
    file: dest.uri,
    isPdf: ext === 'pdf',
    isImage: ['jpg', 'jpeg', 'png', 'heic', 'webp'].includes(ext),
    addedAt: new Date().toISOString(),
  };
  await saveIndex([entry, ...docs]);
  return entry;
}

// Réservation saisie en texte (analyse de confirmation).
export async function addBooking(booking) {
  const docs = await listDocs();
  const entry = { id: `${Date.now()}`, kind: 'reservation', addedAt: new Date().toISOString(), ...booking };
  await saveIndex([entry, ...docs]);
  return entry;
}

export async function updateDoc(id, patch) {
  const docs = await listDocs();
  await saveIndex(docs.map((d) => (d.id === id ? { ...d, ...patch } : d)));
}

export async function removeDoc(id) {
  const docs = await listDocs();
  const d = docs.find((x) => x.id === id);
  if (d?.file) {
    const f = new File(d.file);
    if (f.exists) f.delete();
  }
  await saveIndex(docs.filter((x) => x.id !== id));
}

// Aperçu plein écran iOS (Quick Look) pour les PDF.
export async function previewFile(uri) {
  await new File(uri).preview();
}
