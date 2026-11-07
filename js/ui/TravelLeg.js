// Carte « Arrivée » (jour 1) ou « Départ » (dernier jour) du planning : moyen de transport,
// aéroport ou gare, heure, puis comment rejoindre l'hébergement (horaires, durée, tarifs).
import { html, useState } from '../../vendor/preact.js';
import { store } from '../core/store.js';
import { Icon, Chip, Button } from './components.js';
import { LineBadge, showOnMap } from './TransitPanel.js';
import TimeField from './TimeField.js';
import { toast } from './dialogs.js';
import { MODES, transferPlan, keyTime, unpackPath } from '../lib/arrival.js';
import { hasGoogle, searchPlaces } from '../lib/google.js';
import { searchAddress } from '../lib/places.js';
import { normTime } from '../lib/dates.js';

const TYPE_ICON = { train: 'train', metro: 'train-subway', bus: 'bus', navette: 'van-shuttle', taxi: 'taxi', vtc: 'car', tram: 'train-tram' };

export default function TravelLeg({ trip, tripId, dir }) {
  const field = dir === 'arrivee' ? 'arrival' : 'departure';
  const timeField = dir === 'arrivee' ? 'arrivalTime' : 'departureTime';
  const leg = trip[field] || {};
  const mode = MODES.find((m) => m.id === leg.mode);
  const [open, setOpen] = useState(!leg.plan);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(null);

  const save = (patch) => store.update(`trips/${tripId}`, { [field]: { ...leg, ...patch } });
  const setHotelTime = (t) => store.update(`trips/${tripId}`, { [timeField]: normTime(t) });

  const search = async (e, text) => {
    e?.preventDefault();
    const query = (text ?? q).trim();
    if (!query) return;
    setSearching(true);
    const near = trip.lodging?.lat ? trip.lodging : trip.city;
    let list = [];
    try {
      if (hasGoogle()) list = await searchPlaces(query, near);
    } catch {
      list = [];
    }
    if (!list.length) {
      try {
        list = await searchAddress(query, trip.city);
      } catch {
        list = [];
      }
    }
    setResults(list.slice(0, 6));
    if (!list.length) toast('Aucun lieu trouvé');
    setSearching(false);
  };
  const pick = (p) => {
    save({ place: { name: p.name, lat: p.lat, lon: p.lon, googleId: p.googleId || null, address: p.address || p.tags?.street || '' }, plan: null });
    setResults(null);
    setQ('');
  };

  const compute = async () => {
    setBusy(true);
    try {
      const plan = await transferPlan(trip, leg, dir);
      const t = keyTime(leg, dir, plan.routes, plan.ai);
      await store.update(`trips/${tripId}`, { [field]: { ...leg, plan }, ...(t ? { [timeField]: t } : {}) });
      if (t) toast(dir === 'arrivee' ? `Arrivée à l’hébergement vers ${t}` : `Quitter l’hébergement vers ${t}`);
    } catch (e) {
      toast(e.message);
    }
    setBusy(false);
  };

  const plan = leg.plan;
  const stale = plan && plan.key !== `${leg.place?.name}|${leg.time}|${trip.lodging?.name}`;
  const title = dir === 'arrivee' ? 'Arrivée' : 'Départ';
  const hotelLabel = dir === 'arrivee' ? 'Arrivée à l’hébergement' : 'Quitter l’hébergement';
  const rec = plan?.ai?.find((o) => o.recommande) || plan?.ai?.[0];

  if (!open && leg.mode)
    return html`<button class="legsum" onClick=${() => setOpen(true)}>
      <${Icon} name=${mode?.icon || 'plane'} />
      <span class="grow">
        <b>${title}${leg.place?.name ? ` · ${leg.place.name}` : ''}${leg.time ? ` · ${leg.time}` : ''}</b>
        <small>${trip[timeField] ? `${hotelLabel} vers ${trip[timeField]}` : ''}${rec ? ` · ${rec.nom}${rec.prix_famille ? ` (${rec.prix_famille})` : ''}` : ''}</small>
      </span>
      <${Icon} name="chevron-down" />
    </button>`;

  return html`<div class="leg">
    <div class="row between">
      <b><${Icon} name=${dir === 'arrivee' ? 'plane-arrival' : 'plane-departure'} /> ${title}</b>
      ${leg.mode ? html`<button class="iconbtn" onClick=${() => setOpen(false)} aria-label="Réduire"><${Icon} name="chevron-up" /></button>` : null}
    </div>
    <div class="chips">${MODES.map((m) => html`<${Chip} label=${m.label} icon=${m.icon} active=${leg.mode === m.id} onClick=${() => save({ mode: m.id, plan: null })} />`)}</div>

    ${mode && mode.id !== 'voiture'
      ? html`
          ${leg.place
            ? html`<div class="legplace"><${Icon} name=${mode.icon} /><span class="grow"><b>${leg.place.name}</b>${leg.place.address ? html`<small>${leg.place.address}</small>` : null}</span>
                <button class="linkbtn" onClick=${() => save({ place: null, plan: null })}>Changer</button></div>`
            : html`<form class="row" onSubmit=${search}>
                  <input class="input grow" style="margin:0" placeholder=${mode.id === 'avion' ? 'Aéroport : ex. Gatwick' : 'Gare : ex. St Pancras'} value=${q} onInput=${(e) => setQ(e.target.value)} />
                  <${Button} icon="magnifying-glass" small loading=${searching} />
                </form>
                ${!results && !q ? html`<button class="linkbtn mt" onClick=${() => search(null, `${mode.id === 'avion' ? 'aéroport' : 'gare'} ${trip.city?.name || ''}`)}>
                      <${Icon} name="magnifying-glass" /> Voir les ${mode.id === 'avion' ? 'aéroports' : 'gares'} de ${trip.city?.name || 'la destination'}</button>` : null}
                ${results?.map((r) => html`<button class="legres" onClick=${() => pick(r)}><b>${r.name}</b><small>${r.address || r.tags?.street || ''}</small></button>`)}`}
          <label class="legtime"><span class="grow">${mode.at[dir]}</span><${TimeField} value=${leg.time} onSave=${(t) => save({ time: t, plan: null })} placeholder="Heure ?" /></label>
          ${leg.place && leg.time
            ? html`<${Button} title=${plan && !stale ? 'Recalculer' : dir === 'arrivee' ? 'Comment aller à l’hébergement ?' : 'Comment aller à l’aéroport / la gare ?'} icon="route" variant=${plan && !stale ? 'ghost' : 'accent'} loading=${busy} onClick=${compute} />`
            : null}
          ${plan && !stale
            ? html`<div class="legplan">
                ${plan.routes?.length
                  ? html`<div class="small bold mt">Horaires exacts (Google)</div>
                      ${plan.note ? html`<div class="muted xs">${plan.note}</div>` : null}
                      ${plan.routes.map(
                        (r, i) => html`<div class="legroute" onClick=${() => setDetail(detail === i ? null : i)}>
                          <div class="row between"><b>${r.start || r.dep} → ${r.end || r.arr}</b><span class="muted small">${r.min} min porte à porte${r.fare ? html` · <b style="color:var(--text)">${r.fare}</b> /pers.` : ''}</span></div>
                          <div class="muted xs">${dir === 'arrivee' ? `Départ de ${leg.place?.name || 'l’aéroport'} à ${r.start || r.dep}, arrivée à l’hébergement à ${r.end || r.arr}` : `Départ de l’hébergement à ${r.start || r.dep}, arrivée à ${r.end || r.arr}`}${r.parts[0]?.type === 'walk' && r.parts[0].min >= 15 && dir === 'arrivee' ? ` · les ${r.parts[0].min} min de marche du début partent du point central de l’aéroport : depuis votre terminal, c’est souvent bien moins` : ''}.</div>
                          <div class="tlines">${r.parts.map((p) => (p.type === 'transit' ? html`<${LineBadge} p=${p} />` : html`<span class="walkbit"><${Icon} name="person-walking" />${p.min} min</span>`))}</div>
                          ${r.parts.some((p) => p.path)
                            ? html`<button class="tmapbtn" onClick=${(e) => {
                                e.stopPropagation();
                                const route = { ...r, parts: r.parts.map((p) => ({ ...p, coords: unpackPath(p.path) })) };
                                const to = dir === 'arrivee' ? trip.lodging : leg.place;
                                showOnMap(route, { name: to.name, lat: to.lat, lon: to.lon });
                              }}><${Icon} name="route" /> Voir l’itinéraire sur la carte</button>`
                            : null}
                          ${detail === i
                            ? r.parts.map((p) =>
                                p.type === 'walk'
                                  ? html`<div class="tstep muted small"><${Icon} name="person-walking" /> Marcher ${p.min} min</div>`
                                  : html`<div class="tstep small"><${LineBadge} p=${p} /><span><b>${p.dep}</b> ${p.from}<br /><small class="muted">direction ${p.headsign} · ${p.min} min</small><br /><b>${p.arr}</b> ${p.to}</span></div>`
                              )
                            : null}
                        </div>`
                      )}`
                  : null}
                ${plan.ai?.length
                  ? html`<div class="small bold mt">Toutes les solutions et les prix</div>
                      ${plan.ai.map(
                        (o) => html`<div class=${`legopt ${o.recommande ? 'rec' : ''}`}>
                          <div class="row between"><b><${Icon} name=${TYPE_ICON[o.type] || 'bus'} /> ${o.nom}</b>${o.recommande ? html`<span class="ai-tag">conseillé</span>` : null}</div>
                          <div class="small">${o.duree_min ? `${o.duree_min} min` : ''}${o.prix_famille ? ` · ${o.prix_famille} la famille` : ''}${o.prix_adulte ? ` (${o.prix_adulte} /adulte)` : ''}</div>
                          ${o.frequence || o.horaires ? html`<div class="muted xs">${[o.frequence, o.horaires].filter(Boolean).join(' · ')}</div>` : null}
                          ${o.achat ? html`<div class="muted xs"><${Icon} name="ticket" /> ${o.achat}</div>` : null}
                          ${o.astuce ? html`<div class="xs" style="color:var(--success)"><${Icon} name="piggy-bank" /> ${o.astuce}</div>` : null}
                        </div>`
                      )}
                      <div class="muted xs">Prix et horaires estimés par l’IA : à vérifier avant le départ.</div>`
                  : null}
              </div>`
            : null}`
      : null}

    <label class="legtime hotel"><${Icon} name="bed" /><span class="grow">${hotelLabel}</span><${TimeField} value=${trip[timeField]} onSave=${setHotelTime} placeholder="Heure ?" /></label>
    ${mode && mode.id !== 'voiture' && plan && !stale ? html`<div class="muted xs">Calculée d’après le trajet${dir === 'arrivee' ? ` (sortie ${mode.id === 'avion' ? 'de l’avion et bagages' : 'du train'} comprise)` : ` (arrivée ${mode.id === 'avion' ? '2 h avant le vol' : '20 min avant le train'})`} ; modifiable.</div>` : null}
  </div>`;
}
