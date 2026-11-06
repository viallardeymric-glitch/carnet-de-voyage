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
import { hasGoogle, healthGoogle } from '../lib/google.js';
import { askAI, hasAI } from '../lib/assistant.js';
import { getParty, describeParty } from '../lib/party.js';

export default function EmergencyView() {
  const { trip, tripId, path } = useApp();
  const party = getParty(trip);
  const pregnant = party.some((t) => t.pregnant);
  const [tipsBusy, setTipsBusy] = useState(false);
  const insuranceDoc = useDoc(path('meta/insurance'));
  const [ins, setIns] = useState({ name: '', phone: '', contract: '' });
  useEffect(() => setIns({ name: insuranceDoc?.name || '', phone: insuranceDoc?.phone || '', contract: insuranceDoc?.contract || '' }), [insuranceDoc?.phone, insuranceDoc?.name, insuranceDoc?.contract]);
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
      let list = [];
      if (hasGoogle()) list = await healthGoogle(o).catch(() => []);
      if (!list.length) list = await fetchHealth(o);
      setHealth(list.map((p) => ({ ...p, d: distanceMeters(o, p) })).sort((a, b) => a.d - b.d));
    } catch {
      setHealth([]);
    }
  };
  useEffect(() => {
    if (trip) load();
  }, [trip?.id]);

  // « Bon à savoir » santé propre à la destination, rédigé une fois par l'IA et partagé (dans le voyage).
  const writeTips = async () => {
    if (!hasAI()) return toast('Ajoutez une clé Gemini ou Groq dans Réglages');
    setTipsBusy(true);
    try {
      const q = `Famille française en voyage à ${trip?.city?.name} (${trip?.city?.country})${trip?.startDate ? ` du ${trip.startDate} au ${trip.endDate}` : ''}. ${describeParty(party)}
Donne 5 à 7 points « bon à savoir » santé et urgences pour cette destination : quel numéro pour quoi, comment consulter un médecin sans urgence, pharmacies (horaires, de garde), prise en charge (carte européenne ou non, avance de frais, assurance), risques sanitaires de la saison, ambassade ou consulat de France (téléphone si tu le connais avec certitude, sinon « à vérifier »).
Réponds uniquement par des lignes commençant par « - », phrases courtes, sans titre.`;
      const text = await askAI({ question: q, system: 'Tu es un médecin conseil en voyage, factuel et prudent. En français.', max: 800 });
      const tips = (text || '').split('\n').map((l) => l.replace(/^[-*•\s]+/, '').replace(/\*\*/g, '').trim()).filter((l) => l.length > 8);
      if (!tips.length) throw new Error("L'IA n'a rien renvoyé, réessayez.");
      await store.update(`trips/${tripId}`, { healthTips: tips });
    } catch (e) {
      toast(e.message);
    }
    setTipsBusy(false);
  };
  const tips = trip?.healthTips || info.tips;
  useEffect(() => {
    if (trip && !trip.healthTips && !info.tips && hasAI() && !tipsBusy) writeTips();
  }, [trip?.id]);

  const hospitals = (health || []).filter((h) => h.isHospital).slice(0, 4);
  const pharmacies = (health || []).filter((h) => !h.isHospital).slice(0, 4);
  const numbers = [['Ambulance / SAMU', info.ambulance], ['Police', info.police], ['Pompiers', info.fire], ...(info.extra || [])];

  const Row = ({ h }) => html`<${Card} style="padding:10px 12px">
    <div class="row">
      <${Icon} name=${h.isHospital ? 'hospital' : 'prescription-bottle-medical'} style="color:var(--danger);font-size:18px;width:24px" />
      <div class="grow">
        <div class="bold">${h.name}</div>
        <div class="muted xs">${formatDistance(h.d)}${h.tags.emergency === 'yes' ? ' · urgences' : ''}${h.openNow === true ? ' · ouvert' : h.openNow === false ? ' · fermé' : ''}${h.tags.opening_hours ? ` · ${h.tags.opening_hours}` : ''}</div>
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
    ${ins.phone
      ? html`<a class="card list-item" href=${`tel:${ins.phone.replace(/\s/g, '')}`} style="color:var(--text)"><${Icon} name="shield-heart" style="color:var(--cyan);font-size:20px" /><span class="grow"><b>Assistance ${ins.name}</b>${ins.contract ? html`<div class="muted xs">Contrat ${ins.contract}</div>` : null}</span><b style="color:var(--cyan)">${ins.phone}</b></a>`
      : null}
    ${tips
      ? html`<${SafetyBox} title=${`Bon à savoir · ${trip?.city?.country || ''}`}>${tips.map((t) => html`<p>• ${t}</p>`)}
          ${hasAI() ? html`<button class="linkbtn" onClick=${writeTips}><${Icon} name="rotate" /> ${tipsBusy ? 'Rédaction…' : 'Refaire avec l’IA'}</button>` : null}</${SafetyBox}>`
      : tipsBusy
        ? html`<${Card}><div class="muted small"><${Icon} name="wand-magic-sparkles" /> Rédaction du « bon à savoir » santé…</div></${Card}>`
        : hasAI()
          ? html`<${Button} small variant="ghost" title="Bon à savoir santé (IA)" icon="wand-magic-sparkles" onClick=${writeTips} />`
          : null}
    ${pregnant ? html`<${SafetyBox} title="Grossesse : points de vigilance" icon="person-pregnant">${PREGNANCY_TIPS.map((t) => html`<p>• ${t}</p>`)}</${SafetyBox}>` : null}

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

    <${Subtitle}>Notre assurance / assistance (partagée)</${Subtitle}>
    <${Card}>
      <input class="input" placeholder="Assureur (ex. Visa Premier – Mondial Assistance)" value=${ins.name} onInput=${(e) => setIns({ ...ins, name: e.target.value })} />
      <div class="row">
        <input class="input grow" style="margin:0" type="tel" placeholder="Téléphone d'assistance" value=${ins.phone} onInput=${(e) => setIns({ ...ins, phone: e.target.value })} />
        <input class="input grow" style="margin:0" placeholder="N° de contrat" value=${ins.contract} onInput=${(e) => setIns({ ...ins, contract: e.target.value })} />
      </div>
      <${Button} small title="Enregistrer" icon="floppy-disk" onClick=${() => (store.set(path('meta/insurance'), ins), toast('Assurance enregistrée'))} />
    </${Card}>

    <${Subtitle}>Nos notes médicales (partagées)</${Subtitle}>
    <textarea class="input" value=${notes} onInput=${(e) => setNotes(e.target.value)}
      placeholder="Groupe sanguin, terme prévu, allergies, traitement, médecin / sage-femme en France…"></textarea>
    <${Button} title="Enregistrer" icon="floppy-disk" onClick=${() => (store.set(path('meta/medical'), { text: notes }), toast('Notes enregistrées'))} />
  </div>`;
}
