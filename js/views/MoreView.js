import { html } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { Card, Icon, MemberBadge } from '../ui/components.js';

const ITEMS = [
  { to: 'assistant', icon: 'wand-magic-sparkles', label: 'Assistant de suggestions', sub: "Que faire maintenant, selon l'heure et la météo" },
  { to: 'transports', icon: 'bus', label: 'Transports', sub: 'Prochains départs pour rentrer, plans du métro et des bus' },
  { to: 'horsligne', icon: 'cloud-arrow-down', label: 'Hors-ligne', sub: 'Préparer le voyage pour quand il n’y a pas de réseau' },
  { to: 'checklist', icon: 'list-check', label: 'Check-list de bagages', sub: 'Partagée et synchronisée' },
  { to: 'urgences', icon: 'kit-medical', label: 'Urgences & santé', sub: 'Numéros, hôpitaux et pharmacies proches' },
  { to: 'journal', icon: 'book-open', label: 'Journal de bord', sub: 'Photos et souvenirs de chaque jour' },
  { to: 'voyageurs', icon: 'people-group', label: 'Voyageurs', sub: 'Qui part : enfants, bébé, chien… tout s’adapte' },
  { to: 'voyages', icon: 'plane', label: 'Changer de voyage', sub: 'Créer ou choisir une destination' },
  { to: 'reglages', icon: 'gear', label: 'Réglages', sub: 'Profil, synchronisation, code PIN, Face ID' },
];

export default function MoreView() {
  const { trip, member, mode } = useApp();
  return html`<div class="page">
    <div class="row mb">
      ${member ? html`<${MemberBadge} member=${member} size=${40} />` : null}
      <div class="grow">
        <div class="bold" style="font-size:18px">Bonjour ${member?.name}</div>
        <div class="muted small">${trip?.name} · ${mode === 'firebase' ? 'synchronisé ☁️' : 'sur ce téléphone'}</div>
      </div>
    </div>
    ${ITEMS.map(
      (it) => html`<${Card} onClick=${() => go(it.to)}>
        <div class="row">
          <${Icon} name=${it.icon} style="color:var(--cyan);font-size:20px;width:28px;text-align:center" />
          <div class="grow"><div class="bold" style="font-size:16px">${it.label}</div><div class="muted small">${it.sub}</div></div>
          <${Icon} name="chevron-right" cls="muted" />
        </div>
      </${Card}>`
    )}
  </div>`;
}
