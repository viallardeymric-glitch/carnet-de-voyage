// Hors-ligne : ce qui marche sans réseau, et préparation du voyage en un bouton.
import { html, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { prepareOffline, offlineReadyAt } from '../lib/offline.js';
import { Card, Button, Icon, Subtitle, SafetyBox } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';

const OK = [
  ['map', "La carte autour de l'hôtel et des lieux prévus (une fois préparée)"],
  ['calendar-days', 'Le planning, la boîte à idées, le budget et la check-list'],
  ['lock', 'Le coffre-fort : billets, QR codes et PDF'],
  ['location-dot', 'Les fiches et photos des lieux déjà ouverts ou préparés'],
  ['kit-medical', "Les numéros d'urgence et vos notes médicales"],
];
const KO = [
  ['wand-magic-sparkles', "L'IA (guides, assistant) : seulement ce qui a déjà été rédigé"],
  ['bus', 'Les horaires des transports en direct'],
  ['magnifying-glass', 'La recherche de nouveaux lieux sur la carte'],
];

export default function OfflineView() {
  const { trip, path } = useApp();
  const { items: places } = useCollection(path('places'));
  const [prog, setProg] = useState(null);
  const ready = offlineReadyAt(trip);

  const go = async () => {
    if (!navigator.onLine) return toast('Connectez-vous (Wi-Fi de préférence) pour préparer');
    setProg([0, 1]);
    try {
      const n = await prepareOffline(trip, places, (d, t) => setProg([d, t]));
      toast(`Voyage prêt hors-ligne (${n} éléments)`);
    } catch (e) {
      toast(`Préparation interrompue : ${e.message}`);
    }
    setProg(null);
  };

  return html`<div class="page">
    <${Card}>
      <div class="row mb">
        <${Icon} name="cloud-arrow-down" style="font-size:26px;color:var(--navy)" />
        <div class="grow">
          <div class="bold">Préparer « ${trip?.name} » pour le hors-ligne</div>
          <div class="muted small">${ready ? `Déjà préparé le ${new Date(ready).toLocaleDateString('fr-FR')} — refaites-le après avoir ajouté des lieux.` : 'À faire la veille du départ, en Wi-Fi.'}</div>
        </div>
      </div>
      ${prog
        ? html`<div class="small mb">Téléchargement… ${prog[0]} / ${prog[1]}</div><div class="bar"><div style=${`width:${(prog[0] / prog[1]) * 100}%;background:var(--navy)`}></div></div>`
        : html`<${Button} title="Tout préparer" icon="cloud-arrow-down" variant="accent" onClick=${go} />`}
    </${Card}>
    <${Subtitle}>Fonctionne sans réseau</${Subtitle}>
    <${Card} style="padding:4px 14px">${OK.map(([i, t]) => html`<div class="list-item"><${Icon} name=${i} style="color:var(--success);width:22px" /><span class="grow small">${t}</span></div>`)}</${Card}>
    <${Subtitle}>Besoin de réseau</${Subtitle}>
    <${Card} style="padding:4px 14px">${KO.map(([i, t]) => html`<div class="list-item"><${Icon} name=${i} style="color:var(--muted);width:22px" /><span class="grow small">${t}</span></div>`)}</${Card}>
    <${SafetyBox} title="Bon à savoir" icon="circle-info">
      <p>Ce que l'un de vous modifie hors-ligne (dépense, case cochée…) est gardé sur le téléphone et envoyé à l'autre dès le retour du réseau.</p>
      <p>Pour les longs trajets sans réseau, vous pouvez aussi télécharger la zone dans Plans ou Google Maps.</p>
    </${SafetyBox}>
  </div>`;
}
