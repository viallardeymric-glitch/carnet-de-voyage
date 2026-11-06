// Lecture temps réel d'une collection Firestore + copie locale (mode hors-ligne).
// Au démarrage on affiche la dernière copie enregistrée sur le téléphone,
// puis Firestore prend le relais dès que le réseau répond.
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const cacheKey = (path) => `cache:${path}`;

export function useCollection(path, sortFn) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (!path) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    let alive = true;
    AsyncStorage.getItem(cacheKey(path)).then((raw) => {
      if (alive && raw) {
        setItems(JSON.parse(raw));
        setFromCache(true);
        setLoading(false);
      }
    });
    const unsub = onSnapshot(
      collection(db, path),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!alive) return;
        setItems(data);
        setFromCache(snap.metadata.fromCache);
        setLoading(false);
        AsyncStorage.setItem(cacheKey(path), JSON.stringify(data)).catch(() => {});
      },
      (err) => {
        console.warn('Firestore', path, err.message);
        setLoading(false);
      }
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [path]);

  return { items: sortFn ? [...items].sort(sortFn) : items, loading, fromCache };
}

export function useDocument(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    AsyncStorage.getItem(cacheKey(path)).then((raw) => alive && raw && setData(JSON.parse(raw)));
    const unsub = onSnapshot(
      doc(db, path),
      (snap) => {
        const d = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        if (!alive) return;
        setData(d);
        if (d) AsyncStorage.setItem(cacheKey(path), JSON.stringify(d)).catch(() => {});
      },
      (err) => console.warn('Firestore', path, err.message)
    );
    return () => {
      alive = false;
      unsub();
    };
  }, [path]);
  return data;
}
