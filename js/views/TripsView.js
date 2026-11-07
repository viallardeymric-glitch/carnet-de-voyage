// Liste des voyages + création (n'importe quelle ville du monde).
import { html, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection, store } from '../core/store.js';
import { searchCities, searchAddress } from '../lib/places.js';
import { createTrip, createLondonTrip } from '../lib/trips.js';
import { frToISO, formatShort } from '../lib/dates.js';
import { Card, Button, Input, Icon, Subtitle, Empty } from '../ui/components.js';
import { toast, confirm } from '../ui/dialogs.js';
import { ls } from '../core/config.js';

export default function TripsView() {
  const { tripId, setTripId, memberId } = useApp();
  const { items: trips } = useCollection('trips', (a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(null);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [lodgingQuery, setLodgingQuery] = useState('');
  const [lodgings, setLodgings] = useState([]);
  const [lodging, setLodging] = useState(null);
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');

  const choose = (id) => {
    setTripId(id);
    go('planning');
  };

  const del = async (e, t) => {
    e.stopPropagation();
    const vault = ls.get('vaultTrip', null) === t.id;
    const ok = await confirm(
      `Supprimer « ${t.name} » ?`,
      `Le voyage disparaîtra des deux téléphones (planning, lieux, budget, journal).${vault ? ' Le coffre-fort, lui, est conservé.' : ''}`,
      'Supprimer'
    );
    if (!ok) return;
    await store.remove(`trips/${t.id}`);
    if (t.id === tripId) setTripId(trips.find((x) => x.id !== t.id)?.id || null);
    toast('Voyage supprimé');
  };

  const london = async () => {
    setBusy(true);
    try {
      choose(await createLondonTrip(memberId));
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  };

  const find = async (fn, q, set, extra) => {
    try {
      const r = await fn(q, extra);
      set(r);
      if (!r.length) toast('Aucun résultat');
    } catch {
      toast('Recherche impossible (réseau)');
    }
  };

  const save = async () => {
    const s = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : frToISO(start || '');
    const e = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : frToISO(end || '');
    if (!city) return toast('Choisissez d’abord la destination');
    if (!s || !e || e < s) return toast('Choisissez les dates d’arrivée et de départ');
    setBusy(true);
    const id = await createTrip({ name: name || `Voyage à ${city.name}`, city, startDate: s, endDate: e, lodging: lodging ? { ...lodging, verified: !!lodging.googleId } : null, arrivalTime: arrival || null, departureTime: departure || null }, memberId);
    setBusy(false);
    setCreating(false);
    choose(id);
  };

  if (!creating)
    return html`<div class="page">
      <h2 class="title">Nos voyages</h2>
      ${trips.length === 0 ? html`<${Empty} icon="plane" text="Aucun voyage pour l'instant." />` : null}
      ${trips.map(
        (t) => html`<${Card} onClick=${() => choose(t.id)} style=${t.id === tripId ? 'border:2px solid var(--cyan)' : ''}>
          <div class="row">
            <${Icon} name="location-dot" style="color:var(--cyan);font-size:20px" />
            <div class="grow">
              <div class="bold" style="font-size:17px">${t.name}</div>
              <div class="muted small">${t.city?.name} · ${t.startDate && formatShort(t.startDate)} → ${t.endDate && formatShort(t.endDate)}</div>
            </div>
            <button class="iconbtn" aria-label="Supprimer le voyage" onClick=${(e) => del(e, t)}><${Icon} name="trash-can" /></button>
            <${Icon} name="chevron-right" cls="muted" />
          </div>
        </${Card}>`
      )}
      ${!trips.some((x) => x.city?.countryCode === 'GB' && x.startDate === '2026-12-27')
        ? html`<${Button} title="Créer « Noël à Londres » (27–30 déc. 2026)" icon="gift" variant="accent" onClick=${london} loading=${busy} />`
        : null}
      <${Button} title="Nouveau voyage" icon="plus" onClick=${() => setCreating(true)} />
    </div>`;

  return html`<div class="page">
    <h2 class="title">Nouveau voyage</h2>
    <${Subtitle}>1. Destination</${Subtitle}>
    ${city
      ? html`<${Card}><div class="row"><${Icon} name="circle-check" style="color:var(--success)" />
          <div class="grow">${city.name}, ${city.country} (${city.currency})</div>
          <${Button} title="Changer" small variant="ghost" onClick=${() => setCity(null)} /></div></${Card}>`
      : html`<form class="row" onSubmit=${(e) => (e.preventDefault(), find(searchCities, cityQuery, setCities))}>
            <input class="input grow" style="margin:0" placeholder="Ex. Rome, Lisbonne, Annecy…" value=${cityQuery} onInput=${(e) => setCityQuery(e.target.value)} />
            <${Button} icon="magnifying-glass" small />
          </form>
          <div class="mt">
            ${cities.map(
              (c) => html`<${Card} onClick=${() => (setCity(c), setCities([]))}>
                <div class="bold">${c.name}</div><div class="muted small ellipsis">${c.label}</div>
              </${Card}>`
            )}
          </div>`}
    <${Subtitle}>2. Dates et nom</${Subtitle}>
    <div class="row">
      <label class="grow"><div class="muted small">Arrivée</div>
        <input class="input" type="date" value=${start} min="2024-01-01" onInput=${(e) => (setStart(e.target.value), (!end || end < e.target.value) && setEnd(e.target.value))} /></label>
      <label class="grow"><div class="muted small">Départ</div>
        <input class="input" type="date" value=${end} min=${start || '2024-01-01'} onInput=${(e) => setEnd(e.target.value)} /></label>
    </div>
    <div class="row">
      <label class="grow"><div class="muted small">Heure d'arrivée à l'hébergement</div>
        <input class="input" type="time" value=${arrival} onInput=${(e) => setArrival(e.target.value)} /></label>
      <label class="grow"><div class="muted small">Heure de départ</div>
        <input class="input" type="time" value=${departure} onInput=${(e) => setDeparture(e.target.value)} /></label>
    </div>
    <div class="muted xs mb">Facultatif : l'IA ne prévoit rien avant votre arrivée ni après votre départ.</div>
    <${Input} label="Nom du voyage (facultatif)" value=${name} onInput=${setName} />
    <${Subtitle}>3. Hébergement (facultatif)</${Subtitle}>
    <div class="muted small mb">Pas encore réservé ? Laissez vide : ajoutez vos visites, puis « Hôtel idéal » sur la carte montre le meilleur quartier.</div>
    ${lodging
      ? html`<${Card}><div class="row"><${Icon} name="bed" style="color:var(--cyan)" />
          <div class="grow ellipsis">${lodging.name}</div>
          <${Button} title="Changer" small variant="ghost" onClick=${() => setLodging(null)} /></div></${Card}>`
      : html`<form class="row" onSubmit=${(e) => (e.preventDefault(), find(searchAddress, lodgingQuery, setLodgings, city))}>
            <input class="input grow" style="margin:0" placeholder="Nom ou adresse de l'hôtel" value=${lodgingQuery} onInput=${(e) => setLodgingQuery(e.target.value)} />
            <${Button} icon="magnifying-glass" small />
          </form>
          <div class="mt">
            ${lodgings.map(
              (l) => html`<${Card} onClick=${() => (setLodging(l), setLodgings([]))}>
                <div class="bold">${l.name}</div><div class="muted small">${l.address}</div>
              </${Card}>`
            )}
          </div>`}
    <div class="mt"></div>
    <${Button} title="Créer le voyage" icon="check" onClick=${save} loading=${busy} />
    <${Button} title="Annuler" variant="ghost" onClick=${() => setCreating(false)} />
  </div>`;
}
