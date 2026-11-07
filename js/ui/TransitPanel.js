// Itinéraire en transports affiché dans l'app : prochains départs, lignes en couleur, arrêts.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { go } from '../core/app.js';
import { transitRoutes, transitByAI, networkPlans, ROUTES_HELP } from '../lib/transit.js';
import { hasGoogle } from '../lib/google.js';
import { hasAI } from '../lib/assistant.js';
import { openDirections } from '../lib/routing.js';
import { Icon, Spinner } from './components.js';
import { md } from './md.js';

const VEHICLE_ICON = { SUBWAY: 'train-subway', METRO_RAIL: 'train-subway', BUS: 'bus', INTERCITY_BUS: 'bus', TROLLEYBUS: 'bus', TRAM: 'train-tram', LIGHT_RAIL: 'train-tram', RAIL: 'train', HEAVY_RAIL: 'train', COMMUTER_TRAIN: 'train', HIGH_SPEED_TRAIN: 'train', FERRY: 'ferry', CABLE_CAR: 'cable-car', GONDOLA_LIFT: 'cable-car', FUNICULAR: 'cable-car' };

export const LineBadge = ({ p }) =>
  html`<span class="line-badge" style=${`background:${p.color};color:${p.textColor}`}><${Icon} name=${VEHICLE_ICON[p.vehicleType] || 'bus'} />${p.line}</span>`;

// Montre un itinéraire sur la carte (tracé, arrêts, ma position qui suit).
export function showOnMap(route, to) {
  sessionStorage.setItem('cdv-guide', JSON.stringify({ route, to: { name: to.name, lat: to.lat, lon: to.lon } }));
  go('carte');
}

// origins : [{ label, point }] — l'utilisateur choisit d'où il part (ma position, l'hôtel…).
export default function TransitPanel({ origins = [], to, city, plansLinks = true, onShow, walk = false }) {
  const [oi, setOi] = useState(0);
  const from = origins[oi]?.point;
  const fromName = origins[oi]?.label || '';
  const [routes, setRoutes] = useState(null);
  const [err, setErr] = useState(null);
  const [ai, setAi] = useState(null);
  const [open, setOpen] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!from || !to) return;
    setBusy(true);
    setErr(null);
    try {
      if (!hasGoogle()) throw Object.assign(new Error('no-key'), { code: 'no-key' });
      let r = await transitRoutes(from, to).catch((e) => (walk ? [] : Promise.reject(e)));
      if (walk) {
        // Pour rejoindre quelqu'un : l'itinéraire à pied d'abord, les transports ensuite.
        const w = await transitRoutes(from, to, null, 'WALK').catch(() => []);
        r = [...w.map((x) => ({ ...x, walkOnly: true })), ...r.filter((x) => !x.walkOnly)];
      }
      setRoutes(r);
      if (!r.length) throw Object.assign(new Error('none'), { code: 'none' });
    } catch (e) {
      setErr(e.code || 'error');
      if (navigator.onLine && hasAI()) transitByAI(fromName, to, city).then(setAi).catch(() => {});
    }
    setBusy(false);
  };
  useEffect(() => {
    load();
  }, [from?.lat, from?.lon, to?.lat]);

  const plans = networkPlans(city);
  return html`<div class="transit">
    ${origins.length > 1
      ? html`<div class="chips mb">${origins.map((o, i) => html`<button class=${`chip ${i === oi ? 'active' : ''}`} onClick=${() => (setRoutes(null), setOi(i))}><${Icon} name=${o.icon || 'location-dot'} />Depuis ${o.label}</button>`)}</div>`
      : null}
    ${!from ? html`<div class="small muted mb">Position indisponible : autorisez la localisation, ou partez de l'hôtel.</div>` : null}
    ${busy && !routes ? html`<${Spinner} />` : null}
    ${routes?.length
      ? html`<div class="row between small muted mb"><span>Départs en direct</span><button class="linkbtn" onClick=${load}><${Icon} name="rotate" /> Actualiser</button></div>
          ${routes.map(
            (r, i) => html`<div class=${`troute ${open === i ? 'on' : ''}`} onClick=${() => setOpen(open === i ? -1 : i)}>
              <div class="row">
                <div class="grow">
                  <div class="tlines">${r.parts.map((p) => (p.type === 'transit' ? html`<${LineBadge} p=${p} />` : html`<span class="walkbit"><${Icon} name="person-walking" />${p.min} min</span>`))}</div>
                  <div class="small muted">${r.walkOnly ? 'À pied' : `${r.dep} → ${r.arr}`}${r.leaveIn != null && r.leaveIn >= 0 ? html` · <b style="color:var(--navy)">partir ${r.leaveIn <= 1 ? 'maintenant' : `dans ${r.leaveIn} min`}</b>` : ''}</div>
                </div>
                <div class="tmin"><b>${r.min}</b><small>min</small></div>
                <button class="tmap" aria-label="Voir sur la carte" onClick=${(e) => (e.stopPropagation(), onShow ? onShow(r) : showOnMap(r, to))}><${Icon} name="route" /></button>
              </div>
              ${open === i
                ? html`<div class="tsteps">${r.parts.map((p) =>
                    p.type === 'walk'
                      ? html`<div class="tstep"><${Icon} name="person-walking" /><span>Marcher ${p.min} min${p.m ? ` (${p.m} m)` : ''}</span></div>`
                      : html`<div class="tstep"><${LineBadge} p=${p} /><span><b>${p.dep}</b> ${p.from}<br /><small class="muted">direction ${p.headsign} · ${p.stops} arrêt${p.stops > 1 ? 's' : ''} · ${p.min} min</small><br /><b>${p.arr}</b> ${p.to}</span></div>`
                  )}
                  <button class="btn sm accent" style="margin-top:8px" onClick=${(e) => (e.stopPropagation(), onShow ? onShow(r) : showOnMap(r, to))}><${Icon} name="route" />Voir le trajet sur la carte</button>
                  </div>`
                : null}
            </div>`
          )}`
      : null}
    ${err === 'disabled'
      ? html`<div class="small mb">Pour voir les horaires ici, activez « Routes API » sur votre clé Google (gratuit dans la limite mensuelle) : <a href=${ROUTES_HELP} target="_blank">ouvrir Google Cloud</a>.</div>`
      : err === 'no-key'
        ? html`<div class="small muted mb">Avec une clé Google (Réglages), les prochains départs s'affichent ici.</div>`
        : err === 'none'
          ? html`<div class="small muted mb">Aucun transport en commun trouvé pour ce trajet à cette heure.</div>`
          : err
            ? html`<div class="small muted mb">${navigator.onLine ? 'Horaires indisponibles pour le moment.' : 'Hors-ligne : horaires indisponibles.'}</div>`
            : null}
    ${err && ai ? html`<div class="guide small"><div class="muted xs mb"><${Icon} name="wand-magic-sparkles" /> Suggestion de l'IA (à vérifier sur place)</div>${md(ai)}</div>` : null}
    <div class="row wrap mt" style="gap:6px">
      ${plansLinks ? plans.map(([label, url]) => html`<a class="pill" href=${url} target="_blank"><${Icon} name="map" /> ${label}</a>`) : null}
      <button class="pill" onClick=${() => openDirections(to, 'transit')}><${Icon} name="up-right-from-square" /> Plans / Citymapper</button>
    </div>
  </div>`;
}
