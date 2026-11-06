// Devises : taux du jour (Frankfurter / BCE), gardés en mémoire pour le hors-ligne.
import { ls } from '../core/config.js';

const COUNTRY_CURRENCY = {
  GB: 'GBP', US: 'USD', CH: 'CHF', CA: 'CAD', JP: 'JPY', AU: 'AUD', NZ: 'NZD', NO: 'NOK',
  SE: 'SEK', DK: 'DKK', IS: 'ISK', CZ: 'CZK', PL: 'PLN', HU: 'HUF', RO: 'RON', BG: 'BGN',
  TR: 'TRY', MA: 'MAD', TN: 'TND', EG: 'EGP', AE: 'AED', IL: 'ILS', CN: 'CNY', HK: 'HKD',
  SG: 'SGD', KR: 'KRW', TH: 'THB', IN: 'INR', MX: 'MXN', BR: 'BRL', ZA: 'ZAR', AL: 'ALL',
  RS: 'RSD', BA: 'BAM', MK: 'MKD', GE: 'GEL', IE: 'EUR',
};

export const currencyForCountry = (cc) => COUNTRY_CURRENCY[cc] || 'EUR';

export const CURRENCY_SYMBOL = { EUR: '€', GBP: '£', USD: '$', CHF: 'CHF', JPY: '¥' };
export const sym = (c) => CURRENCY_SYMBOL[c] || c;

export function formatMoney(amount, currency = 'EUR') {
  const n = Number(amount || 0).toFixed(2).replace('.', ',');
  return currency === 'EUR' ? `${n} €` : `${n} ${sym(currency)}`;
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
  for (const src of sources) {
    try {
      const res = await src();
      if (res.rates) {
        res.rates.EUR = 1;
        ls.set(KEY, res);
        return { ...res, offline: false };
      }
    } catch {
      // on essaie la source suivante
    }
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
