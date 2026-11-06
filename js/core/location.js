// Géolocalisation croisée : j'envoie ma position et je reçois celle de mon/ma conjoint(e).
// Fonctionne tant que l'app est ouverte à l'écran (limite des web-apps sur iPhone).
import { useEffect, useRef, useState } from '../../vendor/preact.js';
import { useApp } from './app.js';
import { store, useCollection } from './store.js';
import { ls } from './config.js';

let lastFix = ls.get('lastFix');
export const lastKnownPosition = () => lastFix;

export function getPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(lastFix);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lastFix = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() };
        ls.set('lastFix', lastFix);
        resolve(lastFix);
      },
      () => resolve(lastFix),
      { enableHighAccuracy: false, timeout, maximumAge: 60000 }
    );
  });
}

export const sharingEnabled = () => ls.get('sharing', true);
export const setSharingEnabled = (v) => ls.set('sharing', v);

export function useLiveLocation() {
  const { memberId, path, mode } = useApp();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const lastSent = useRef(0);
  const positionsPath = path('positions');
  const { items: positions } = useCollection(mode === 'firebase' ? positionsPath : null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('unsupported');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy };
        lastFix = { ...fix, at: Date.now() };
        ls.set('lastFix', lastFix);
        setMe(fix);
        setError(null);
      },
      (e) => setError(e.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Envoi au plus toutes les 15 secondes (mode synchronisé uniquement).
  useEffect(() => {
    if (mode !== 'firebase' || !me || !positionsPath) return;
    const ref = `${positionsPath}/${memberId}`;
    if (!sharingEnabled()) {
      store.set(ref, { sharing: false, updatedAtMs: Date.now() }, true);
      return;
    }
    if (Date.now() - lastSent.current < 15000) return;
    lastSent.current = Date.now();
    store.set(ref, { lat: me.lat, lon: me.lon, accuracy: me.accuracy ?? null, sharing: true, updatedAtMs: Date.now() });
  }, [me, memberId, positionsPath, mode]);

  const others = positions.filter((p) => p.id !== memberId && p.sharing !== false && p.lat != null);
  return { me, others, error };
}
