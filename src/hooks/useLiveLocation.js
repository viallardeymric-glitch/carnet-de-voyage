// Géolocalisation croisée : j'envoie ma position dans Firestore et je reçois
// celle de mon/ma conjoint(e). Fonctionne quand l'app est ouverte (Expo Go).
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { useCollection } from './useCollection';

const SHARE_KEY = 'location:sharing';

export function useSharingPreference() {
  const [sharing, setSharingState] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(SHARE_KEY).then((v) => setSharingState(v !== 'off'));
  }, []);
  const setSharing = async (v) => {
    setSharingState(v);
    await AsyncStorage.setItem(SHARE_KEY, v ? 'on' : 'off');
  };
  return [sharing, setSharing];
}

export function useLiveLocation() {
  const { memberId } = useAuth();
  const { path } = useTrip();
  const [me, setMe] = useState(null);
  const [permission, setPermission] = useState(null);
  const [sharing, setSharing] = useSharingPreference();
  const lastSent = useRef(0);
  const positionsPath = path('positions');
  const { items: positions } = useCollection(positionsPath);

  useEffect(() => {
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status);
      if (status !== 'granted') return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: 10000 },
        (loc) => setMe({ lat: loc.coords.latitude, lon: loc.coords.longitude, accuracy: loc.coords.accuracy })
      );
    })();
    return () => sub?.remove();
  }, []);

  // Envoi à Firestore au plus toutes les 15 secondes.
  useEffect(() => {
    if (!me || !memberId || !positionsPath) return;
    const ref = doc(db, positionsPath, memberId);
    if (!sharing) {
      setDoc(ref, { sharing: false, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      return;
    }
    if (Date.now() - lastSent.current < 15000) return;
    lastSent.current = Date.now();
    setDoc(ref, { lat: me.lat, lon: me.lon, accuracy: me.accuracy ?? null, sharing: true, updatedAt: serverTimestamp() }).catch(
      () => {}
    );
  }, [me, memberId, positionsPath, sharing]);

  const others = positions
    .filter((p) => p.id !== memberId && p.sharing !== false && p.lat != null)
    .map((p) => ({ ...p, updatedAtMs: p.updatedAt?.seconds ? p.updatedAt.seconds * 1000 : null }));

  return { me, others, permission, sharing, setSharing };
}
