// Budget commun de la famille : dépenses partagées, budget prévu, convertisseur de devises.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useCollection } from '../core/store.js';
import { getRates, convert, formatMoney, formatRate, sym, currencyForCountry } from '../lib/currency.js';
import { calc, isCalc } from '../lib/calc.js';
import { ls } from '../core/config.js';

const KEYS = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', ',', '0', '⌫', '='];
import { toISO, formatDay, tripDays } from '../lib/dates.js';
import { Card, Button, Chip, Icon, Subtitle, Empty } from '../ui/components.js';
import { confirm, toast, prompt } from '../ui/dialogs.js';

const CATS = [
  { id: 'repas', label: 'Repas', icon: 'utensils' },
  { id: 'transport', label: 'Transport', icon: 'bus' },
  { id: 'activite', label: 'Activités', icon: 'ticket' },
  { id: 'logement', label: 'Logement', icon: 'bed' },
  { id: 'courses', label: 'Courses', icon: 'cart-shopping' },
  { id: 'souvenirs', label: 'Souvenirs', icon: 'gift' },
  { id: 'sante', label: 'Santé', icon: 'kit-medical' },
  { id: 'autre', label: 'Autre', icon: 'ellipsis' },
];
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

export default function BudgetView() {
  const { trip, tripId, path, memberId } = useApp();
  const { items: expenses } = useCollection(path('expenses'), (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  // Devise du pays du voyage (recalculée : un voyage créé avant l'ajout du pays à la liste suit aussi).
  const local = (trip?.city?.countryCode && currencyForCountry(trip.city.countryCode) !== 'EUR' ? currencyForCountry(trip.city.countryCode) : trip?.city?.currency) || 'EUR';
  const [rates, setRates] = useState({ rates: { EUR: 1 } });
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(null);
  const [label, setLabel] = useState('');
  const [cat, setCat] = useState('repas');
  const [convAmount, setConvAmount] = useState('10');
  const [toEur, setToEur] = useState(true);
  const [pad, setPad] = useState(ls.get('calcPad', true));
  // Touches de la calculatrice (pas de clavier iPhone : les opérations sont toujours là).
  const press = (k) =>
    setConvAmount((t) => {
      t = String(t || '');
      if (k === 'C') return '';
      if (k === '⌫') return t.slice(0, -1);
      if (k === '=') return calc(t) == null ? t : String(calc(t)).replace('.', ',');
      if (t === '0' && /\d/.test(k)) return k;
      return t + k;
    });
  const cur = currency || local;

  useEffect(() => {
    getRates().then(setRates);
  }, []);

  const add = async () => {
    const value = calc(amount); // « 12,50 + 8 » accepté aussi
    if (!value) return;
    const eur = convert(value, cur, 'EUR', rates.rates);
    if (eur == null) return toast('Taux indisponible : connectez-vous une fois à Internet.');
    await store.add(path('expenses'), {
      label: label || catOf(cat).label,
      amount: value,
      currency: cur,
      amountEur: Math.round(eur * 100) / 100,
      category: cat,
      date: toISO(new Date()),
      createdBy: memberId,
      createdAtMs: Date.now(),
    });
    setAmount('');
    setLabel('');
    setAdding(false);
  };

  const total = expenses.reduce((s, e) => s + (Number(e.amountEur) || 0), 0);
  const planned = Number(trip?.budget) || 0;
  const nDays = tripDays(trip).length || 1;
  const spentDays = new Set(expenses.map((e) => e.date).filter(Boolean)).size || 1;
  const byDay = [];
  for (const e of expenses) {
    const last = byDay[byDay.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else byDay.push({ date: e.date, items: [e] });
  }
  const setBudget = async () => {
    const v = await prompt('Budget prévu', 'Montant total en euros pour tout le séjour (laisser vide pour enlever).', planned ? String(planned) : '');
    if (v == null) return;
    const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
    await store.update(`trips/${tripId}`, { budget: n > 0 ? Math.round(n) : null });
  };
  const byCat = CATS.map((c) => ({ ...c, sum: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + (Number(e.amountEur) || 0), 0) })).filter((c) => c.sum > 0);
  const convValue = calc(convAmount) || 0;
  const converted = toEur ? convert(convValue, local, 'EUR', rates.rates) : convert(convValue, 'EUR', local, rates.rates);

  return html`<div class="page">
    <${Card} cls="hero">
      <div class="label">DÉPENSES COMMUNES</div>
      <div class="big">${formatMoney(total)}</div>
      ${planned
        ? html`<div class="hero-bar"><div style=${`width:${Math.min(100, (total / planned) * 100)}%`}></div></div>
            <div class="row between small" style="margin-top:6px">
              <span>${total <= planned ? `Reste ${formatMoney(planned - total)}` : `Dépassé de ${formatMoney(total - planned)}`}</span>
              <button class="hero-link" onClick=${setBudget}>sur ${formatMoney(planned)} prévus</button>
            </div>`
        : html`<button class="hero-link" style="margin-top:6px" onClick=${setBudget}><${Icon} name="bullseye" /> Fixer un budget pour le séjour</button>`}
      ${total > 0 ? html`<div class="small" style="margin-top:4px;opacity:.9">≈ ${formatMoney(total / spentDays)} par jour${planned ? ` · prévu ${formatMoney(planned / nDays)} par jour` : ''}</div>` : null}
    </${Card}>

    <${Card}>
      <div class="row between">
        <div class="subtitle" style="margin:0">${local !== 'EUR' ? 'Convertisseur et calculs' : 'Calculatrice'}</div>
        ${local !== 'EUR' ? html`<div class="muted xs">1 € = ${formatRate(rates.rates[local])} ${sym(local)}${sym(local) !== local ? ` (${local})` : ''}${rates.offline ? ' (hors ligne)' : ''}</div>` : null}
      </div>
      <div class="row mt">
        <input class="input grow calc-input" style="margin:0" inputmode=${pad ? 'none' : 'decimal'} readonly=${pad} value=${convAmount} onInput=${(e) => setConvAmount(e.target.value)} />
        ${local !== 'EUR'
          ? html`<button class="iconbtn" style="color:var(--cyan);font-size:22px" onClick=${() => setToEur(!toEur)} aria-label="Inverser"><${Icon} name="right-left" /></button>
              <div class="grow bold" style="font-size:18px">${converted != null ? formatMoney(converted, toEur ? 'EUR' : local) : '–'}</div>`
          : null}
      </div>
      <div class="row between mt">
        <div class="muted xs">${isCalc(convAmount) ? html`<b style="color:var(--text)">= ${calc(convAmount) == null ? '…' : formatMoney(calc(convAmount), local !== 'EUR' && toEur ? local : 'EUR')}</b>${local !== 'EUR' ? ' · ' : ''}` : ''}${local !== 'EUR' ? (toEur ? `${local} → EUR` : `EUR → ${local}`) : ''}</div>
        <button class="linkbtn" onClick=${() => (setPad(!pad), ls.set('calcPad', !pad))}><${Icon} name="calculator" /> ${pad ? 'Clavier du téléphone' : 'Calculatrice'}</button>
      </div>
      ${pad
        ? html`<div class="calcpad">${KEYS.map((k) => html`<button class=${`ck ${/[÷×−+%()]/.test(k) ? 'op' : ''} ${k === 'C' ? 'clr' : ''}`} onClick=${() => press(k)}>${k}</button>`)}</div>`
        : null}
    </${Card}>

    ${adding
      ? html`<${Card}>
          <div class="row">
            <input class="input grow" style="margin:0" inputmode="decimal" placeholder="Montant" value=${amount} onInput=${(e) => setAmount(e.target.value)} autofocus />
            ${[...new Set([local, 'EUR'])].map((c) => html`<${Chip} label=${c} active=${cur === c} onClick=${() => setCurrency(c)} />`)}
          </div>
          <input class="input mt" placeholder="Libellé (facultatif)" value=${label} onInput=${(e) => setLabel(e.target.value)} />
          <div class="chips wrap mb">${CATS.map((c) => html`<${Chip} label=${c.label} icon=${c.icon} active=${cat === c.id} onClick=${() => setCat(c.id)} />`)}</div>
          <div class="row">
            <${Button} cls="grow" title="Enregistrer" icon="check" onClick=${add} />
            <${Button} cls="grow" title="Annuler" variant="ghost" onClick=${() => setAdding(false)} />
          </div>
        </${Card}>`
      : html`<${Button} title="Ajouter une dépense" icon="plus" variant="accent" onClick=${() => setAdding(true)} />`}

    ${byCat.length
      ? html`<${Subtitle}>Par catégorie</${Subtitle}>
          <${Card}>
            ${byCat.map(
              (c) => html`<div class="mb">
                <div class="row between"><span><${Icon} name=${c.icon} style="color:var(--cyan);width:20px" /> ${c.label}</span><b>${formatMoney(c.sum)}</b></div>
                <div class="bar"><div style=${`width:${(c.sum / total) * 100}%`}></div></div>
              </div>`
            )}
          </${Card}>`
      : null}

    <${Subtitle}>Dépenses</${Subtitle}>
    ${expenses.length === 0 ? html`<${Empty} icon="wallet" text="Aucune dépense enregistrée." />` : null}
    ${byDay.map(
      (g) => html`<div class="muted xs bold" style="margin:10px 4px 6px;text-transform:uppercase;letter-spacing:.04em">${g.date ? formatDay(g.date) : 'Sans date'}</div>
        ${g.items.map(
          (e) => html`<${Card} style="padding:10px 12px">
            <div class="row">
              <span class="cat-dot"><${Icon} name=${catOf(e.category).icon} /></span>
              <div class="grow" style="min-width:0">
                <div class="bold">${e.label}</div>
                <div class="muted xs">${catOf(e.category).label}</div>
              </div>
              <div style="text-align:right">
                <div class="bold">${formatMoney(e.amount, e.currency)}</div>
                ${e.currency !== 'EUR' ? html`<div class="muted xs">${formatMoney(e.amountEur)}</div>` : null}
              </div>
              <button class="iconbtn" onClick=${async () => (await confirm('Supprimer cette dépense ?', e.label, 'Supprimer')) && store.remove(`${path('expenses')}/${e.id}`)}>
                <${Icon} name="trash-can" />
              </button>
            </div>
          </${Card}>`
        )}`
    )}
  </div>`;
}
