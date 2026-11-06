// Urgences : numéros du pays, hôpitaux et pharmacies proches, notes médicales partagées.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useDoc } from '../core/store.js';
import { getPosition } from '../core/location.js';
import { emergencyFor, PREGNANCY_TIPS } from '../data/emergency.js';
import { fetchHealth } from '../lib/places.js';
import { distanceMeters, formatDistance } from '../lib/geo.js';
import { openDirections } from '../lib/routing.js';
import { Card, Button, Icon, Subtitle, SafetyBox, Spinner } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';

export default function EmergencyView() {
  const { trip, path } = useApp();
  const info = emergencyFor(trip?.city?.countryCode);
  const notesDoc = useDoc(path('meta/medical'));
  const [notes, setNotes] = useState('');
  const [health, setHealth] = useState(null);
  const [fromHotel, setFromHotel] = useState(false);

  useEffect(() => setNotes(notesDoc?.text || ''), [notesDoc?.text]);

  const load = async () => {
    setHealth(null);
    const pos = await getPosition();
    const o = pos || trip?.lodging || trip?.city;
    setFromHotel(!pos);
    try {
      const list = await fetchHealth(o);
      setHealth(list.map((p) => ({ ...p, d: distanceMeters(o, p) })).sort((a, b) => a.d - b.d));
    } catch {
      setHealth([]);
    }
  };
  useEffect(() => {
    if (trip) load();
  }, [trip?.id]);

  const hospitals = (health || []).filter((h) => h.isHospital).slice(0, 4);
  const pharmacies = (health || []).filter((h) => !h.isHospital).slice(0, 4);
  const numbers = [['Ambulance / SAMU', info.ambulance], ['Police', info.police], ['Pompiers', info.fire], ...(info.extra || [])];

  const Row = ({ h }) => html`<${Card} style="padding:10px 12px">
    <div class="row">
      <${Icon} name=${h.isHospital ? 'hospital' : 'prescription-bottle-medical'} style="color:var(--danger);font-size:18px;width:24px" />
      <div class="grow">
        <div class="bold">${h.name}</div>
        <div class="muted xs">${formatDistance(h.d)}${h.tags.emergency === 'yes' ? ' · urgences' : ''}${h.tags.opening_hours ? ` · ${h.tags.opening_hours}` : ''}</div>
      </div>
      ${h.tags.phone ? html`<a class="iconbtn" style="color:var(--cyan)" href=${`tel:${h.tags.phone.replace(/\s/g, '')}`}><${Icon} name="phone" /></a>` : null}
      <button class="iconbtn" style="color:var(--cyan)" onClick=${() => openDirections(h, 'car')}><${Icon} name="diamond-turn-right" /></button>
    </div>
  </${Card}>`;

  return html`<div class="page">
    <a href=${`tel:${info.general}`} class="card" style="display:block;background:var(--danger);border-color:var(--danger);color:#fff">
      <div class="row">
        <${Icon} name="phone" style="font-size:26px" />
        <div><div style="font-size:22px;font-weight:800">Appeler le ${info.general}</div><div>Urgences · ${trip?.city?.country || ''}</div></div>
      </div>
    </a>
    <${Card} style="padding:2px 14px">
      ${numbers.map(([label, n]) => html`<a class="list-item" href=${`tel:${n}`} style="color:var(--text)"><span class="grow">${label}</span><b style="color:var(--cyan);font-size:17px">${n}</b></a>`)}
    </${Card}>
    ${info.tips ? html`<${SafetyBox} title=${`Bon à savoir · ${trip?.city?.country}`}>${info.tips.map((t) => html`<p>• ${t}</p>`)}</${SafetyBox}>` : null}
    <${SafetyBox} title="Grossesse : points de vigilance" icon="person-pregnant">${PREGNANCY_TIPS.map((t) => html`<p>• ${t}</p>`)}</${SafetyBox}>

    <div class="row between">
      <div class="subtitle">Hôpitaux les plus proches</div>
      <button class="iconbtn" style="color:var(--cyan)" onClick=${load}><${Icon} name="rotate" /></button>
    </div>
    ${!health ? html`<${Spinner} />` : null}
    ${health && !hospitals.length ? html`<div class="muted small">Aucun hôpital trouvé à proximité (ou pas de réseau).</div>` : null}
    ${hospitals.map((h) => html`<${Row} h=${h} />`)}
    <${Subtitle}>Pharmacies</${Subtitle}>
    ${pharmacies.map((h) => html`<${Row} h=${h} />`)}
    ${health ? html`<div class="muted xs">Distances depuis ${fromHotel ? "l'hôtel" : 'votre position'}.</div>` : null}

    <${Subtitle}>Nos notes médicales (partagées)</${Subtitle}>
    <textarea class="input" value=${notes} onInput=${(e) => setNotes(e.target.value)}
      placeholder="Groupe sanguin, terme prévu, allergies, traitement, médecin / sage-femme en France…"></textarea>
    <${Button} title="Enregistrer" icon="floppy-disk" onClick=${() => (store.set(path('meta/medical'), { text: notes }), toast('Notes enregistrées'))} />
  </div>`;
}
