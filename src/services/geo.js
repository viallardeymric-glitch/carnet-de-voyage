import { FAMILY_WALK_KMH } from '../config/settings';

// Distance à vol d'oiseau en mètres (formule de haversine).
export function distanceMeters(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m) {
  if (m == null) return '–';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
}

// Temps de marche estimé au rythme d'un enfant de 5 ans
// (on multiplie la distance à vol d'oiseau par 1,3 pour tenir compte des rues).
export function familyWalkMinutes(m) {
  if (m == null) return null;
  return Math.max(1, Math.round(((m * 1.3) / 1000 / FAMILY_WALK_KMH) * 60));
}

// ---------------------------------------------------------------------------
// Optimisation d'itinéraire : « plus proche voisin » puis amélioration 2-opt.
// Donne un ordre de visite court en partant (optionnellement) de l'hébergement.
// ---------------------------------------------------------------------------
export function optimizeOrder(points, start) {
  const pts = points.filter((p) => p.lat != null && p.lon != null);
  const others = points.filter((p) => p.lat == null || p.lon == null);
  if (pts.length < 3 && !start) return [...pts, ...others];

  // 1) Plus proche voisin
  const remaining = [...pts];
  const route = [];
  let current = start || remaining.shift();
  if (!start) route.push(current);
  while (remaining.length) {
    let best = 0;
    let bestD = Infinity;
    remaining.forEach((p, i) => {
      const d = distanceMeters(current, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    current = remaining.splice(best, 1)[0];
    route.push(current);
  }

  // 2) 2-opt : on inverse des segments tant que cela raccourcit le trajet
  const full = start ? [start, ...route] : route;
  const offset = start ? 1 : 0;
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = offset; i < full.length - 2; i++) {
      for (let k = i + 1; k < full.length - 1; k++) {
        const a = full[i - 1] || full[i];
        const b = full[i];
        const c = full[k];
        const d = full[k + 1];
        const before = (i > 0 ? distanceMeters(a, b) : 0) + distanceMeters(c, d);
        const after = (i > 0 ? distanceMeters(a, c) : 0) + distanceMeters(b, d);
        if (after + 1 < before) {
          const reversed = full.slice(i, k + 1).reverse();
          full.splice(i, k - i + 1, ...reversed);
          improved = true;
        }
      }
    }
  }
  const ordered = start ? full.slice(1) : full;
  return [...ordered, ...others];
}

export function routeLength(points, start) {
  const pts = [start, ...points].filter((p) => p && p.lat != null);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distanceMeters(pts[i - 1], pts[i]);
  return total;
}
