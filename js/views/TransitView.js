// Transports : rentrer à l'hôtel avec les prochains départs, et plans du réseau.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { getPosition } from '../core/location.js';
import { distanceMeters } from '../lib/geo.js';
import { networkPlans } from '../lib/transit.js';
import TransitPanel from '../ui/TransitPanel.js';
import { Card, Icon, Subtitle, Spinner } from '../ui/components.js';

export default function TransitView() {
  const { trip } = useApp();
  const [me, setMe] = useState(undefined);
  useEffect(() => {
    getPosition().then((p) => setMe(p || null));
  }, []);
  const hotel = trip?.lodging ? { ...trip.lodging, isLodging: true } : null;
  const near = me && hotel && distanceMeters(me, hotel) < 40000;
  return html`<div class="page">
    <${Subtitle}>Rentrer à l'hôtel</${Subtitle}>
    ${!hotel ? html`<div class="muted small">Ajoutez l'hébergement du voyage pour l'itinéraire du retour.</div>` : null}
    ${hotel && me === undefined ? html`<${Spinner} />` : null}
    ${hotel && me !== undefined
      ? near
        ? html`<${Card}><${TransitPanel} origins=${[{ label: "ma position", icon: "location-crosshairs", point: me }]} to=${hotel} city=${trip?.city?.name} plansLinks=${false} /></${Card}>`
        : html`<div class="muted small">${me ? "Vous n'êtes pas encore sur place : l'itinéraire du retour s'affichera là-bas." : 'Position indisponible : autorisez la localisation pour l’itinéraire du retour.'}</div>`
      : null}
    <div class="muted xs mt">Pour aller vers un lieu : ouvrez sa fiche, puis « Y aller » › Transports.</div>
    <${Subtitle}>Plans du réseau · ${trip?.city?.name || ''}</${Subtitle}>
    <${Card} style="padding:4px 14px">
      ${networkPlans(trip?.city?.name).map(([label, url]) => html`<a class="list-item" href=${url} target="_blank" style="color:var(--text)"><${Icon} name="map" style="color:var(--cyan);width:22px" /><span class="grow">${label}</span><${Icon} name="up-right-from-square" cls="muted" /></a>`)}
    </${Card}>
  </div>`;
}
