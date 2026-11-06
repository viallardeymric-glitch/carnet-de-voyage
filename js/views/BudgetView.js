// Budget partagé : dépenses à deux, « qui doit combien à qui », convertisseur de devises.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useCollection } from '../core/store.js';
import { getRates, convert, formatMoney } from '../lib/currency.js';
import { toISO, formatDay } from '../lib/dates.js';
import { Card, Button, Chip, Icon, Subtitle, Empty, MemberBadge } from '../ui/components.js';
import { confirm, toast } from '../ui/dialogs.js';

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

// Positif = on doit de l'argent à cette personne.
export function computeBalance(expenses) {
  const net = { E: 0, M: 0 };
  for (const e of expenses) {
    const v = Number(e.amountEur) || 0;
    net[e.paidBy] += v;
    if (e.forWhom === 'both') {
      net.E -= v / 2;
      net.M -= v / 2;
    } else net[e.forWhom] -= v;
  }
  return net;
}

export default function BudgetView() {
  const { trip, path, memberId, members } = useApp();
  const { items: expenses } = useCollection(path('expenses'), (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const local = trip?.city?.currency || 'EUR';
  const [rates, setRates] = useState({ rates: { EUR: 1 } });
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(null);
  const [label, setLabel] = useState('');
  const [paidBy, setPaidBy] = useState(memberId);
  const [forWhom, setForWhom] = useState('both');
  const [cat, setCat] = useState('repas');
  const [convAmount, setConvAmount] = useState('10');
  const [toEur, setToEur] = useState(true);
  const cur = currency || local;

  useEffect(() => {
    getRates().then(setRates);
  }, []);

  const add = async () => {
    const value = Number(String(amount).replace(',', '.'));
    if (!value) return;
    const eur = convert(value, cur, 'EUR', rates.rates);
    if (eur == null) return toast('Taux indisponible : connectez-vous une fois à Internet.');
    await store.add(path('expenses'), {
      label: label || catOf(cat).label,
      amount: value,
      currency: cur,
      amountEur: Math.round(eur * 100) / 100,
      paidBy,
      forWhom,
      category: cat,
      date: toISO(new Date()),
      createdBy: memberId,
      createdAtMs: Date.now(),
    });
    setAmount('');
    setLabel('');
    setAdding(false);
  };

  const net = computeBalance(expenses);
  const total = expenses.reduce((s, e) => s + (Number(e.amountEur) || 0), 0);
  const debtor = net.E < -0.005 ? 'E' : net.M < -0.005 ? 'M' : null;
  const byCat = CATS.map((c) => ({ ...c, sum: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + (Number(e.amountEur) || 0), 0) })).filter((c) => c.sum > 0);
  const convValue = Number(String(convAmount).replace(',', '.')) || 0;
  const converted = toEur ? convert(convValue, local, 'EUR', rates.rates) : convert(convValue, 'EUR', local, rates.rates);

  return html`<div class="page">
    <${Card} cls="hero">
      <div class="label">TOTAL DÉPENSÉ</div>
      <div class="big">${formatMoney(total)}</div>
      <div style="margin-top:6px">
        ${debtor ? `${members[debtor].name} doit ${formatMoney(-net[debtor])} à ${members[debtor === 'E' ? 'M' : 'E'].name}` : 'Vous êtes quittes 🎉'}
      </div>
    </${Card}>

    ${local !== 'EUR'
      ? html`<${Card}>
          <div class="row between">
            <div class="subtitle" style="margin:0">Convertisseur</div>
            <div class="muted xs">1 € = ${rates.rates[local]?.toFixed(4) || '?'} ${local}${rates.offline ? ' (hors ligne)' : ''}</div>
          </div>
          <div class="row mt">
            <input class="input grow" style="margin:0" inputmode="decimal" value=${convAmount} onInput=${(e) => setConvAmount(e.target.value)} />
            <button class="iconbtn" style="color:var(--cyan);font-size:22px" onClick=${() => setToEur(!toEur)} aria-label="Inverser"><${Icon} name="right-left" /></button>
            <div class="grow bold" style="font-size:18px">${converted != null ? formatMoney(converted, toEur ? 'EUR' : local) : '–'}</div>
          </div>
          <div class="muted xs mt">${toEur ? `${local} → EUR` : `EUR → ${local}`}</div>
        </${Card}>`
      : null}

    ${adding
      ? html`<${Card}>
          <div class="row">
            <input class="input grow" style="margin:0" inputmode="decimal" placeholder="Montant" value=${amount} onInput=${(e) => setAmount(e.target.value)} autofocus />
            ${[...new Set([local, 'EUR'])].map((c) => html`<${Chip} label=${c} active=${cur === c} onClick=${() => setCurrency(c)} />`)}
          </div>
          <input class="input mt" placeholder="Libellé (facultatif)" value=${label} onInput=${(e) => setLabel(e.target.value)} />
          <div class="chips wrap">${CATS.map((c) => html`<${Chip} label=${c.label} icon=${c.icon} active=${cat === c.id} onClick=${() => setCat(c.id)} />`)}</div>
          <div class="muted small mt">Payé par</div>
          <div class="chips mt">${Object.values(members).map((m) => html`<${Chip} label=${m.name} active=${paidBy === m.id} color=${m.color} onClick=${() => setPaidBy(m.id)} />`)}</div>
          <div class="muted small mt">Pour</div>
          <div class="chips mt mb">
            <${Chip} label="Commun (50/50)" active=${forWhom === 'both'} onClick=${() => setForWhom('both')} />
            ${Object.values(members).map((m) => html`<${Chip} label=${m.name} active=${forWhom === m.id} color=${m.color} onClick=${() => setForWhom(m.id)} />`)}
          </div>
          <div class="row">
            <${Button} cls="grow" title="Enregistrer" icon="check" onClick=${add} />
            <${Button} cls="grow" title="Annuler" variant="ghost" onClick=${() => setAdding(false)} />
          </div>
        </${Card}>`
      : html`<${Button} title="Ajouter une dépense" icon="plus" variant="accent" onClick=${() => (setPaidBy(memberId), setAdding(true))} />`}

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
    ${expenses.map(
      (e) => html`<${Card} style="padding:10px 12px">
        <div class="row">
          <${Icon} name=${catOf(e.category).icon} style="color:var(--cyan);width:22px;text-align:center" />
          <div class="grow">
            <div class="bold">${e.label}</div>
            <div class="muted xs">${e.date ? formatDay(e.date) : ''} · ${e.forWhom === 'both' ? 'commun' : `pour ${members[e.forWhom]?.name}`}</div>
          </div>
          <div style="text-align:right">
            <div class="bold">${formatMoney(e.amount, e.currency)}</div>
            ${e.currency !== 'EUR' ? html`<div class="muted xs">${formatMoney(e.amountEur)}</div>` : null}
          </div>
          ${members[e.paidBy] ? html`<${MemberBadge} member=${members[e.paidBy]} size=${24} />` : null}
          <button class="iconbtn" onClick=${async () => (await confirm('Supprimer cette dépense ?', e.label, 'Supprimer')) && store.remove(`${path('expenses')}/${e.id}`)}>
            <${Icon} name="trash-can" />
          </button>
        </div>
      </${Card}>`
    )}
  </div>`;
}
