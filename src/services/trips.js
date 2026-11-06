// Création d'un voyage et de son contenu de départ dans Firestore.
import { collection, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { checklistTemplate } from '../data/checklistTemplate';
import { LONDON_TRIP, LONDON_IDEAS } from '../data/londonSeed';

export async function createTrip(data, memberId, ideas = []) {
  const ref = await addDoc(collection(db, 'trips'), {
    ...data,
    createdBy: memberId,
    createdAt: serverTimestamp(),
  });
  const batch = writeBatch(db);
  checklistTemplate(data.city?.countryCode).forEach((item) => {
    batch.set(doc(collection(db, 'trips', ref.id, 'checklist')), { ...item, createdBy: memberId });
  });
  ideas.forEach((idea, i) => {
    batch.set(doc(collection(db, 'trips', ref.id, 'places')), {
      ...idea,
      day: null,
      order: i,
      status: 'todo',
      favorite: false,
      addedBy: memberId,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return ref.id;
}

export const createLondonTrip = (memberId) => createTrip(LONDON_TRIP, memberId, LONDON_IDEAS);
