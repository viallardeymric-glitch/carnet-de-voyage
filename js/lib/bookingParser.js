// Analyse d'une confirmation de réservation collée en texte (email, SMS, PDF copié).
// On repère les informations utiles avec des expressions régulières : aucune donnée
// n'est envoyée sur Internet.
const MONTHS = {
  jan: 1, janv: 1, january: 1, janvier: 1, feb: 2, fev: 2, févr: 2, february: 2, février: 2, fevrier: 2,
  mar: 3, march: 3, mars: 3, apr: 4, avr: 4, april: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juin: 6,
  jul: 7, july: 7, juil: 7, juillet: 7, aug: 8, august: 8, aout: 8, août: 8, sep: 9, sept: 9, september: 9,
  septembre: 9, oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, déc: 12,
  december: 12, décembre: 12, decembre: 12,
};

const uniq = (a) => [...new Set(a)];

export function parseBooking(text) {
  const t = text.replace(/\s+/g, ' ');
  const lower = t.toLowerCase();

  // Type de réservation
  let kind = 'autre';
  if (/(vol|flight|boarding|embarquement|easyjet|ryanair|air france|british airways|vueling|transavia)/i.test(t)) kind = 'vol';
  else if (/(train|sncf|eurostar|thameslink|tgv|ouigo|trenitalia|renfe|gatwick express)/i.test(t)) kind = 'train';
  else if (/(hôtel|hotel|check-in|arrivée|premier inn|booking\.com|airbnb|nuit|night)/i.test(t)) kind = 'hebergement';
  else if (/(billet|ticket|entrée|admission|museum|musée)/i.test(t)) kind = 'activite';

  // Référence de réservation
  const refMatch = t.match(
    /(?:r[ée]f[ée]rence|booking (?:ref(?:erence)?|number)|confirmation(?: number| n°)?|code de r[ée]servation|PNR|dossier|reservation number|num[ée]ro de r[ée]servation)\s*[:#n°]*\s*([A-Z0-9-]{5,14})/i
  );

  // Numéros de vol (ex. EZY8541, U2 1234, AF1234)
  const flights = uniq((t.match(/\b(?:[A-Z]{2}|[A-Z]\d|\d[A-Z]|EZY|RYR|BAW|AFR|VLG|TVF)\s?\d{2,4}\b/g) || []).filter((f) => !/^\d/.test(f) || /[A-Z]/.test(f)));

  // Dates : 27/12/2026, 27.12.26, 2026-12-27, 27 décembre 2026, Dec 27 2026
  const dates = [];
  for (const m of t.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g)) dates.push(fmt(m[1], m[2], m[3]));
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) dates.push(fmt(m[3], m[2], m[1]));
  for (const m of lower.matchAll(/\b(\d{1,2})(?:er)?\s+([a-zéû]{3,9})\.?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[2]];
    if (mo) dates.push(fmt(m[1], mo, m[3]));
  }
  for (const m of lower.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[1]];
    if (mo) dates.push(fmt(m[2], mo, m[3]));
  }

  // Heures : 12:15, 12h15, 9h
  const times = uniq((t.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/g) || []).filter((x) => /[:h]\d|h$/.test(x)));

  // Montant
  const price = t.match(/(?:total|montant|prix|price|amount)[^0-9£€$]{0,20}([£€$]?\s?\d+[.,]\d{2}\s?[£€$]?)/i);

  return {
    kind,
    reference: refMatch?.[1] || '',
    flights: flights.slice(0, 4),
    dates: uniq(dates.filter(Boolean)).sort((a, b) => a.split('/').reverse().join('').localeCompare(b.split('/').reverse().join(''))).slice(0, 4),
    times: times.slice(0, 6),
    price: price?.[1]?.trim() || '',
  };
}

function fmt(d, m, y) {
  let yy = Number(y);
  if (yy < 100) yy += 2000;
  const dd = Number(d);
  const mm = Number(m);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
  return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yy}`;
}

export const KIND_LABELS = {
  vol: { label: 'Vol', icon: 'plane' },
  train: { label: 'Train', icon: 'train' },
  hebergement: { label: 'Hébergement', icon: 'bed' },
  activite: { label: 'Activité', icon: 'ticket' },
  reservation: { label: 'Réservation', icon: 'file-lines' },
  autre: { label: 'Document', icon: 'file' },
};
