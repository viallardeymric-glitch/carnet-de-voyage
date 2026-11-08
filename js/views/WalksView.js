// Balades à pied : 3 boucles faciles proposées par l'IA autour de ma position (ou de l'hébergement),
// puis guidage étape par étape sur la carte. Les balades se lancent dès l'ouverture de l'écran.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { getPosition } from '../core/location.js';
import { getWeather } from '../lib/weather.js';
import { hasAI } from '../lib/assistant.js';
import { proposeWalks, buildWalk } from '../lib/walks.js';
import { distanceMeters } from '../lib/geo.js';
import { Card, Button, Chip, Icon } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';
import { ls } from '../core/config.js';

const LENS = [
  [30, '30 min'],
  [60, '1 h'],
  [90, '1 h 30'],
];

export default function WalksView() {
  const { trip } = useApp();
  const [len, setLen] = useState(ls.get('walkLen', 60));
  const [walks, setWalks] = useState(null);
  const [busy, setBusy] = useState(false);
  const [going, setGoing] = useState(null);
  const [from, setFrom] = useState(null);
  const [routes, setRoutes] = useState({}); // trajets préparés en avance : « C'est parti » est instantané
  const [err, setErr] = useState('');

  // Départ : ma position si je suis sur place, sinon l'hébergement (ou le centre-ville).
  const startPoint = async () => {
    const me = await getPosition();
    const ref = trip?.lodging || trip?.city;
    if (me && ref && distanceMeters(me, ref) < 30000) return { name: 'Ma position', lat: me.lat, lon: me.lon };
    return trip?.lodging?.lat != null ? { name: trip.lodging.name, lat: trip.lodging.lat, lon: trip.lodging.lon } : { name: trip.city.name, lat: trip.city.lat, lon: trip.city.lon };
  };

  const find = async (minutes = len, fresh = false) => {
    if (!trip) return;
    setBusy(true);
    setErr('');
    setWalks(null);
    setRoutes({});
    try {
      const st = from || (await startPoint());
      setFrom(st);
      const weather = await getWeather(st).catch(() => null);
      const list = await proposeWalks(trip, st, { weather, minutes, fresh });
      setWalks(list);
      // On prépare les trajets des 3 balades pendant que vous lisez.
      list.forEach((w, i) =>
        buildWalk(w, st, trip.city)
          .then((g) => setRoutes((r) => ({ ...r, [i]: g })))
          .catch(() => {})
      );
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (trip && hasAI()) find();
  }, [trip?.id]);

  const pickLen = (m) => {
    setLen(m);
    ls.set('walkLen', m);
    find(m);
  };

  const start = async (w, i) => {
    setGoing(i);
    try {
      const g = routes[i] || (await buildWalk(w, from, trip.city));
      sessionStorage.setItem('cdv-guide', JSON.stringify(g));
      go('carte');
    } catch (e) {
      toast(e.message);
    }
    setGoing(null);
  };

  if (!hasAI())
    return html`<div class="page"><${Card}><div class="muted">Ajoutez une clé Gemini ou Groq (gratuites) dans Réglages pour que l'IA propose des balades.</div>
      <${Button} title="Réglages" icon="gear" onClick=${() => go('reglages')} /></${Card}></div>`;

  return html`<div class="page">
    <div class="muted small mb">3 boucles faciles${from ? ` au départ ${from.name === 'Ma position' ? 'de votre position' : `de ${from.name}`}` : ''}, sans visite payante. La carte vous guide ensuite étape par étape.</div>
    <div class="chips mb">${LENS.map(([m, l]) => html`<${Chip} label=${l} active=${len === m} onClick=${() => pickLen(m)} />`)}</div>
    ${busy
      ? html`<${Card}><div class="row"><span class="spinner small"></span><span class="muted">L’IA dessine des balades autour de vous…</span></div>
          ${[0, 1, 2].map(() => html`<div class="walk"><div class="skeleton" style="width:60%"></div><div class="skeleton mt" style="width:90%"></div><div class="skeleton mt" style="width:75%"></div></div>`)}</${Card}>`
      : null}
    ${err ? html`<${Card}><div class="muted small mb">${err}</div><${Button} title="Réessayer" icon="rotate" onClick=${() => find()} /></${Card}>` : null}
    ${walks?.map(
      (w, i) => html`<${Card}><div class="walk" style="border:0;padding:0;margin:0">
        <div class="row between"><b>${w.titre}</b><span class="muted small">≈ ${w.duree_min || len} min</span></div>
        ${w.ambiance ? html`<div class="small">${w.ambiance}</div>` : null}
        <ol class="walksteps">${(routes[i]?.stops.map((x) => ({ nom: x.name, info: x.info })) || w.etapes).map((e) => html`<li><b>${e.nom}</b>${e.info ? html` · <span class="muted">${e.info}</span>` : null}</li>`)}</ol>
        ${w.pause ? html`<div class="xs"><${Icon} name="mug-hot" style="color:var(--cyan)" /> ${w.pause}</div>` : null}
        ${w.conseil ? html`<div class="xs muted"><${Icon} name="child" /> ${w.conseil}</div>` : null}
        ${routes[i] ? html`<div class="xs muted mt"><${Icon} name="shoe-prints" /> ${routes[i].km.toFixed(1).replace('.', ',')} km · ≈ ${routes[i].route.min} min de marche</div>` : null}
        <${Button} title=${going === i ? 'Préparation du trajet…' : 'C’est parti : voir sur la carte'} icon="map-location-dot" small loading=${going === i} onClick=${() => start(w, i)} />
      </div></${Card}>`
    )}
    ${walks ? html`<${Button} title="Autres idées" icon="rotate" variant="ghost" onClick=${() => find(len, true)} loading=${busy} />` : null}
  </div>`;
}
