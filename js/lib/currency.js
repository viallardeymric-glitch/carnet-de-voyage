// Devises : taux du jour (Frankfurter / BCE), gardés en mémoire pour le hors-ligne.
import { ls } from '../core/config.js';

const COUNTRY_CURRENCY = {
  GB: 'GBP', US: 'USD', CH: 'CHF', CA: 'CAD', JP: 'JPY', AU: 'AUD', NZ: 'NZD', NO: 'NOK',
  SE: 'SEK', DK: 'DKK', IS: 'ISK', CZ: 'CZK', PL: 'PLN', HU: 'HUF', RO: 'RON', BG: 'BGN',
  TR: 'TRY', MA: 'MAD', TN: 'TND', EG: 'EGP', AE: 'AED', IL: 'ILS', CN: 'CNY', HK: 'HKD',
  SG: 'SGD', KR: 'KRW', TH: 'THB', IN: 'INR', MX: 'MXN', BR: 'BRL', ZA: 'ZAR', AL: 'ALL',
  RS: 'RSD', BA: 'BAM', MK: 'MKD', GE: 'GEL', IE: 'EUR',
  // Hors zone euro, ailleurs dans le monde
  VN: 'VND', ID: 'IDR', MY: 'MYR', PH: 'PHP', TW: 'TWD', LK: 'LKR', NP: 'NPR', KH: 'KHR', LA: 'LAK', MV: 'MVR',
  JO: 'JOD', OM: 'OMR', QA: 'QAR', SA: 'SAR', BH: 'BHD', KW: 'KWD', LB: 'LBP', AM: 'AMD', AZ: 'AZN', UA: 'UAH',
  MD: 'MDL', BY: 'BYN', RU: 'RUB', KZ: 'KZT', UZ: 'UZS', DZ: 'DZD', SN: 'XOF', CI: 'XOF', BJ: 'XOF', TG: 'XOF',
  ML: 'XOF', BF: 'XOF', NE: 'XOF', CM: 'XAF', GA: 'XAF', CG: 'XAF', TD: 'XAF', CF: 'XAF', GQ: 'XAF', KE: 'KES',
  TZ: 'TZS', UG: 'UGX', RW: 'RWF', ET: 'ETB', MU: 'MUR', SC: 'SCR', MG: 'MGA', NA: 'NAD', BW: 'BWP', CV: 'CVE',
  AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', UY: 'UYU', PY: 'PYG', BO: 'BOB', CR: 'CRC', DO: 'DOP', CU: 'CUP',
  JM: 'JMD', GT: 'GTQ', PA: 'PAB', EC: 'USD', SV: 'USD', PR: 'USD', BS: 'BSD', BB: 'BBD', TT: 'TTD',
  PF: 'XPF', NC: 'XPF', WF: 'XPF', FJ: 'FJD', MO: 'MOP', MN: 'MNT', BD: 'BDT', PK: 'PKR', GI: 'GIP', SM: 'EUR',
  VA: 'EUR', MC: 'EUR', AD: 'EUR', ME: 'EUR', XK: 'EUR', LI: 'CHF', FO: 'DKK', GL: 'DKK',
};

export const currencyForCountry = (cc) => COUNTRY_CURRENCY[cc] || 'EUR';

export const CURRENCY_SYMBOL = { EUR: '€', GBP: '£', USD: '$', CHF: 'CHF', JPY: '¥', CNY: '¥', KRW: '₩', INR: '₹', THB: '฿', TRY: '₺', ILS: '₪', VND: '₫', PHP: '₱', UAH: '₴' };
export const sym = (c) => CURRENCY_SYMBOL[c] || c;

// Devises sans centimes au quotidien (yen, dong, roupie indonésienne, franc CFA…).
const NO_CENTS = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF', 'XOF', 'XAF', 'XPF', 'UGX', 'PYG', 'COP', 'LAK', 'KHR', 'UZS', 'MGA', 'RWF', 'TZS', 'LBP', 'IRR', 'MNT']);

export function formatMoney(amount, currency = 'EUR') {
  const d = NO_CENTS.has(currency) ? 0 : 2;
  const n = Number(amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f|\u00a0/g, ' ');
  return `${n} ${currency === 'EUR' ? '€' : sym(currency)}`;
}

// « 1 € = 0,8712 £ » ou « 1 € = 28 000 ₫ » : précision adaptée à la taille du taux.
export function formatRate(rate) {
  if (!rate) return '?';
  const d = rate >= 100 ? 0 : rate >= 10 ? 2 : 4;
  return rate.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f|\u00a0/g, ' ');
}

const KEY = 'rates:EUR';

// Renvoie { rates: { GBP: 0.86, ... }, date, offline }
export async function getRates() {
  const sources = [
    async () => {
      const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR');
      const j = await r.json();
      return { rates: j.rates, date: j.date };
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/EUR');
      const j = await r.json();
      return { rates: j.rates, date: j.time_last_update_utc?.slice(5, 16) };
    },
  ];
  // Les deux sources sont fusionnées : la BCE (≈ 30 devises officielles) complétée par
  // open.er-api (≈ 160 devises : dong, roupie, peso…), pour que chaque pays ait son taux.
  const got = (await Promise.all(sources.map((src) => src().catch(() => null)))).filter((r) => r?.rates);
  if (got.length) {
    const res = { rates: { ...(got[1]?.rates || {}), ...got[0].rates, EUR: 1 }, date: got[0].date };
    ls.set(KEY, res);
    return { ...res, offline: false };
  }
  const cached = ls.get(KEY);
  if (cached) return { ...cached, offline: true };
  // Dernier recours (jamais connecté) : taux approximatifs, à titre indicatif.
  return { rates: { EUR: 1, GBP: 0.86, USD: 1.08, CHF: 0.94, CAD: 1.48, JPY: 165, AUD: 1.65 }, date: 'approx.', offline: true };
}

// Convertit un montant d'une devise vers une autre via l'euro.
export function convert(amount, from, to, rates) {
  if (!rates[from] || !rates[to]) return null;
  return (Number(amount) / rates[from]) * rates[to];
}
