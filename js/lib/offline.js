// Préparer le voyage pour le hors-ligne : fonds de carte autour de l'hôtel et des lieux prévus,
// photos et fiches Google des lieux. Le service worker garde tout ce qui est téléchargé ici.
import { ls } from '../core/config.js';
import { cachedPhoto, findPhoto } from './photos.js';
import { placeDetails, hasGoogle } from './google.js';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const tileXY = (lat, lon, z) => {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return [x, y];
};

async function tileTemplate() {
  const style = await (await fetch(STYLE)).json();
  const src = Object.values(style.sources || {}).find((s) => s.type === 'vector' && (s.url || s.tiles));
  if (src?.tiles) return src.tiles[0];
  const tj = await (await fetch(src.url)).json();
  return tj.tiles[0];
}

// Liste des tuiles autour de chaque point (rayon en km) pour les zooms 11 à 16.
function tilesAround(points, km) {
  const set = new Set();
  for (const p of points) {
    for (let z = 11; z <= 16; z++) {
      const d = z >= 15 ? km : km * 2;
      const dLat = d / 111;
      const dLon = d / (111 * Math.cos((p.lat * Math.PI) / 180));
      const [x0, y0] = tileXY(p.lat + dLat, p.lon - dLon, z);
      const [x1, y1] = tileXY(p.lat - dLat, p.lon + dLon, z);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(`${z}/${x}/${y}`);
    }
  }
  return [...set];
}

async function pool(jobs, n, onDone) {
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const job = jobs[i++];
      await job().catch(() => {});
      onDone();
    }
  };
  await Promise.all(Array.from({ length: n }, worker));
}

export async function prepareOffline(trip, places, onProgress) {
  const city = trip?.city?.name;
  const points = [trip?.lodging, ...places].filter((p) => p?.lat != null);
  if (!points.length && trip?.city) points.push(trip.city);
  const jobs = [];
  // 1) Fonds de carte
  const tpl = await tileTemplate();
  for (const t of tilesAround(points.slice(0, 40), 1.2)) {
    const [z, x, y] = t.split('/');
    jobs.push(() => fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y)));
  }
  // 2) Photos et fiches des lieux prévus
  for (const p of places) {
    jobs.push(async () => {
      const url = cachedPhoto(p, 240) || (await findPhoto(p, { city, width: 240 }));
      if (url) await fetch(url, { mode: 'no-cors' });
    });
    if (hasGoogle()) jobs.push(() => placeDetails(p, city));
  }
  let done = 0;
  onProgress?.(0, jobs.length);
  await pool(jobs, 6, () => onProgress?.(++done, jobs.length));
  ls.set(`offlineReady:${trip?.id || ''}`, Date.now());
  return jobs.length;
}

export const offlineReadyAt = (trip) => ls.get(`offlineReady:${trip?.id || ''}`, null);
