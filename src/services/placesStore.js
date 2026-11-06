// Écritures Firestore pour les lieux du voyage (boîte à idées / planning).
import { collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function savePlace(tripId, place, patch, memberId) {
  const { id, distance, walk, ...data } = place;
  if (id) {
    await updateDoc(doc(db, 'trips', tripId, 'places', id), patch);
    return id;
  }
  const ref = await addDoc(collection(db, 'trips', tripId, 'places'), {
    ...data,
    day: null,
    order: Date.now(),
    status: 'todo',
    favorite: false,
    addedBy: memberId,
    createdAt: serverTimestamp(),
    ...patch,
  });
  return ref.id;
}

export const removePlace = (tripId, id) => deleteDoc(doc(db, 'trips', tripId, 'places', id));

export async function reorder(tripId, orderedPlaces) {
  const batch = writeBatch(db);
  orderedPlaces.forEach((p, i) => batch.update(doc(db, 'trips', tripId, 'places', p.id), { order: i }));
  await batch.commit();
}
