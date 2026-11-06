// Premier lancement : qui utilise ce téléphone + synchronisation (facultative).
import { html, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { getFirebaseConfig, parseFirebaseConfig, setFirebaseConfig } from '../core/config.js';
import { Card, Button, MemberBadge, SafetyBox, Subtitle } from '../ui/components.js';

export default function WelcomeView() {
  const { members, setMemberId, mode } = useApp();
  const [cfgText, setCfgText] = useState('');
  const [err, setErr] = useState('');
  const synced = mode === 'firebase' || !!getFirebaseConfig();

  const saveConfig = () => {
    try {
      setFirebaseConfig(parseFirebaseConfig(cfgText));
      location.reload();
    } catch (e) {
      setErr(`Configuration invalide : ${e.message}`);
    }
  };

  return html`<div class="page" style="padding-top:calc(var(--safe-top) + 40px)">
    <div class="center mb">
      <img src="icons/icon-192.png" class="logo" alt="" />
      <h1 class="title" style="margin-top:14px;font-size:26px">Carnet de Voyage</h1>
      <div class="muted">Notre famille, nos voyages, en toute sécurité.</div>
    </div>

    <${Subtitle}>Qui utilise ce téléphone ?</${Subtitle}>
    ${Object.values(members).map(
      (m) => html`<${Card} onClick=${() => setMemberId(m.id)}>
        <div class="row">
          <${MemberBadge} member=${m} size=${44} />
          <div class="grow">
            <div class="bold" style=${`font-size:18px;color:${m.color}`}>Je suis ${m.name}</div>
            <div class="muted small">Marqueur ${m.id === 'E' ? 'bleu' : 'rose'} « ${m.id} » sur la carte</div>
          </div>
        </div>
      </${Card}>`
    )}

    <${Subtitle}>Synchronisation entre vos deux iPhone</${Subtitle}>
    ${synced
      ? html`<${SafetyBox} title="Synchronisation activée" icon="cloud"><p>Vos données seront partagées en direct avec l'autre téléphone après connexion.</p></${SafetyBox}>`
      : html`<${Card}>
          <p class="small muted" style="margin-top:0">
            Facultatif : sans cela, l'app fonctionne entièrement sur ce téléphone. Pour partager planning, budget et positions,
            collez ici la configuration Firebase (voir le guide), ou ouvrez le lien d'invitation envoyé par l'autre téléphone.
          </p>
          <textarea class="input" placeholder="const firebaseConfig = { apiKey: … };" value=${cfgText} onInput=${(e) => setCfgText(e.target.value)}></textarea>
          ${err ? html`<div class="error">${err}</div>` : null}
          <${Button} title="Activer la synchronisation" icon="cloud-arrow-up" variant="ghost" disabled=${!cfgText} onClick=${saveConfig} />
        </${Card}>`}
  </div>`;
}
