// Dates stockées au format AAAA-MM-JJ, affichées en français.
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toISO(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function frToISO(s) {
  const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  if (d.getDate() !== Number(m[1])) return null;
  return toISO(d);
}

export function formatDay(iso) {
  const d = parseISO(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatShort(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Liste des jours du voyage : [{ index: 1, iso: '2026-12-27' }, ...]
export function tripDays(trip) {
  if (!trip?.startDate || !trip?.endDate) return [];
  const out = [];
  const d = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  let i = 1;
  while (d <= end && i < 60) {
    out.push({ index: i, iso: toISO(d) });
    d.setDate(d.getDate() + 1);
    i++;
  }
  return out;
}

export function todayIndex(trip) {
  const today = toISO(new Date());
  return tripDays(trip).find((d) => d.iso === today)?.index ?? null;
}

// Une couleur par jour du séjour (carte, planning).
const DAY_COLORS = ['#EF5B5B', '#3E7BFA', '#22B07D', '#A66BFF', '#FF8A3D', '#14B8C4', '#E5484D', '#D4A017'];
export const dayColor = (day) => DAY_COLORS[(Math.max(1, day) - 1) % DAY_COLORS.length];

// « 9:5 », « 09:05:00 », « 9h05 » → « 09:05 » ; sinon null.
export const normTime = (t) => {
  const m = /^\s*(\d{1,2})\s*[:hH]\s*(\d{1,2})?/.exec(t || '');
  if (!m || +m[1] > 23 || +(m[2] || 0) > 59) return null;
  return `${m[1].padStart(2, '0')}:${(m[2] || '0').padStart(2, '0')}`;
};
