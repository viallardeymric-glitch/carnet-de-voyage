import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { setFirebaseConfig, parseFirebaseConfig, inviteLink, setMembers, ls, THEMES, applyAppearance } from '../core/config.js';
import { biometricsSupported, biometricsEnabled, enableBiometrics, disableBiometrics, resetPin } from '../core/lock.js';
import { sharingEnabled, setSharingEnabled } from '../core/location.js';
import { AI_PROVIDERS, getAiKeys, setAiKey } from '../lib/assistant.js';
import { getGoogleKey, setGoogleKey } from '../lib/photos.js';
import { pushKey } from '../core/sharedKeys.js';
import { store } from '../core/store.js';
import { Card, Button, Chip, Subtitle, Switch, SafetyBox } from '../ui/components.js';
import { confirm, toast } from '../ui/dialogs.js';

export default function SettingsView() {
  const { user, mode, members, memberId, setMemberId, refreshMembers, pinChanged, logout, lock, member } = useApp();
  const [bioOk, setBioOk] = useState(false);
  const [bioOn, setBioOn] = useState(biometricsEnabled());
  const [sharing, setSharing] = useState(sharingEnabled());
  const [cfgText, setCfgText] = useState('');
  const [aiKeys, setAiKeys] = useState(getAiKeys());
  const [aiDraft, setAiDraft] = useState({});
  const saveAi = (id, v) => (setAiKey(id, v), pushKey(id, v), setAiKeys(getAiKeys()), setAiDraft({ ...aiDraft, [id]: '' }));
  const [gkey, setGkey] = useState('');
  const [hasG, setHasG] = useState(!!getGoogleKey());
  const [names, setNames] = useState({ E: members.E.name, M: members.M.name });
  const [theme, setTheme] = useState(ls.get('theme', 'lagon'));
  const [scheme, setScheme] = useState(ls.get('scheme', 'auto'));
  const pickTheme = (id) => (ls.set('theme', id), setTheme(id), applyAppearance());
  const pickScheme = (id) => (ls.set('scheme', id), setScheme(id), applyAppearance());

  useEffect(() => {
    biometricsSupported().then(setBioOk);
  }, []);

  const toggleBio = async (v) => {
    if (v) {
      try {
        await enableBiometrics(member.name);
        setBioOn(true);
      } catch {
        toast("Face ID n'a pas pu être activé");
      }
    } else {
      disableBiometrics();
      setBioOn(false);
    }
  };

  const share = async () => {
    const link = inviteLink();
    try {
      if (navigator.share) await navigator.share({ title: 'Carnet de Voyage', text: 'Ouvre ce lien pour synchroniser notre app de voyage', url: link });
      else {
        await navigator.clipboard.writeText(link);
        toast('Lien copié');
      }
    } catch {
      /* partage annulé */
    }
  };

  const saveCfg = () => {
    try {
      setFirebaseConfig(parseFirebaseConfig(cfgText));
      location.reload();
    } catch (e) {
      toast(`Configuration invalide : ${e.message}`);
    }
  };

  const copyLocalToCloud = async () => {
    const data = ls.get('db', {});
    if (!(await confirm('Envoyer les données locales ?', 'Les voyages créés sur ce téléphone avant la synchronisation seront copiés dans Firebase.', 'Envoyer', false))) return;
    let n = 0;
    for (const [coll, docs] of Object.entries(data)) for (const [id, v] of Object.entries(docs)) (await store.set(`${coll}/${id}`, v), n++);
    toast(`${n} éléments envoyés`);
  };

  const row = (label, sub, control) => html`<div class="row" style="padding:8px 0"><div class="grow"><div class="bold">${label}</div>${sub ? html`<div class="muted xs">${sub}</div>` : null}</div>${control}</div>`;

  return html`<div class="page">
    <${Subtitle}>Apparence</${Subtitle}>
    <${Card}>
      <div class="row" style="gap:18px;justify-content:center">
        ${THEMES.map(
          (t) => html`<div class="center" onClick=${() => pickTheme(t.id)} style="cursor:pointer">
            <div class=${`swatch ${theme === t.id ? 'on' : ''}`} style=${`background:linear-gradient(135deg,${t.colors[0]},${t.colors[1]})`}></div>
            <div class="xs mt">${t.label}</div>
          </div>`
        )}
      </div>
      <div class="chips mt" style="justify-content:center">
        ${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([id, l]) => html`<${Chip} label=${l} active=${scheme === id} onClick=${() => pickScheme(id)} />`)}
      </div>
    </${Card}>

    <${Subtitle}>Profil</${Subtitle}>
    <${Card}>
      <div class="chips wrap mb">${Object.values(members).map((m) => html`<${Chip} label=${`Je suis ${m.name}`} active=${memberId === m.id} color=${m.color} onClick=${() => setMemberId(m.id)} />`)}</div>
      <div class="row">
        <input class="input grow" value=${names.E} onInput=${(e) => setNames({ ...names, E: e.target.value })} aria-label="Prénom E" />
        <input class="input grow" value=${names.M} onInput=${(e) => setNames({ ...names, M: e.target.value })} aria-label="Prénom M" />
      </div>
      <${Button} small variant="ghost" title="Enregistrer les prénoms" onClick=${() => (setMembers({ E: { name: names.E }, M: { name: names.M } }), refreshMembers(), toast('Prénoms enregistrés'))} />
    </${Card}>

    <${Subtitle}>Synchronisation</${Subtitle}>
    <${Card}>
      ${mode === 'firebase'
        ? html`<div class="small mb">☁️ Synchronisé avec Firebase · connecté : <b>${user?.email}</b></div>
            <${Button} title="Inviter l'autre téléphone" icon="share-from-square" variant="accent" onClick=${share} />
            <div class="muted xs mb">Le lien transmet la configuration (pas votre mot de passe). L'autre personne se connecte avec son propre compte.</div>
            ${Object.keys(ls.get('db', {})).length ? html`<${Button} title="Envoyer les données créées avant la synchro" variant="ghost" small onClick=${copyLocalToCloud} />` : null}
            <${Button} title="Se déconnecter" icon="right-from-bracket" variant="ghost" onClick=${logout} />
            <${Button} title="Désactiver la synchronisation" variant="ghost" small onClick=${async () => (await confirm('Désactiver ?', 'Ce téléphone repassera en mode local.', 'Désactiver')) && (setFirebaseConfig(null), location.reload())} />`
        : html`<div class="small mb">📱 Données enregistrées sur ce téléphone uniquement.</div>
            <textarea class="input" placeholder="Collez ici const firebaseConfig = { … }" value=${cfgText} onInput=${(e) => setCfgText(e.target.value)}></textarea>
            <${Button} title="Activer la synchronisation" icon="cloud-arrow-up" disabled=${!cfgText} onClick=${saveCfg} />`}
    </${Card}>

    <${Subtitle}>Sécurité</${Subtitle}>
    <${Card}>
      ${row('Face ID / Touch ID', bioOk ? 'Déverrouillage rapide (app et coffre-fort)' : 'Non disponible ici', html`<${Switch} checked=${bioOn} disabled=${!bioOk} onChange=${toggleBio} />`)}
      <${Button} title="Verrouiller maintenant" icon="lock" variant="ghost" small onClick=${lock} />
      <${Button} title="Changer de code PIN" icon="key" variant="ghost" small onClick=${async () => (await confirm('Changer de code ?', 'Vous allez choisir un nouveau code.', 'Continuer', false)) && (resetPin(), pinChanged())} />
    </${Card}>

    <${Subtitle}>Position</${Subtitle}>
    <${Card}>
      ${row('Partager ma position', mode === 'firebase' ? "Visible uniquement par l'autre téléphone, quand l'app est ouverte" : 'Nécessite la synchronisation', html`<${Switch} checked=${sharing} onChange=${(v) => (setSharingEnabled(v), setSharing(v))} />`)}
    </${Card}>

    <${Subtitle}>Assistant IA (optionnel)</${Subtitle}>
    <${Card}>
      <div class="muted small mb">Mettez Gemini et Groq : les deux sont gratuits, et si l'un atteint sa limite du jour, l'autre prend le relais automatiquement.</div>
      ${AI_PROVIDERS.map(
        (p) => html`<div class="ai-row">
          <div class="row between">
            <b>${p.label}</b>
            ${aiKeys[p.id] ? html`<span class="ok-tag"><i class="fa-solid fa-circle-check"></i> Activée</span>` : html`<span class="muted xs">${p.hint}</span>`}
          </div>
          ${aiKeys[p.id]
            ? html`<${Button} small variant="ghost" title="Retirer la clé" onClick=${() => saveAi(p.id, null)} />`
            : html`<div class="row" style="margin-top:6px">
                <input class="input grow" style="margin:0" type="password" placeholder=${p.placeholder} value=${aiDraft[p.id] || ''} onInput=${(e) => setAiDraft({ ...aiDraft, [p.id]: e.target.value })} autocomplete="off" />
                <${Button} small title="OK" disabled=${!aiDraft[p.id]} onClick=${() => saveAi(p.id, aiDraft[p.id].trim())} />
              </div>`}
        </div>`
      )}
    </${Card}>

    <${Subtitle}>Photos Google (optionnel)</${Subtitle}>
    <${Card}>
      <div class="row between mb">
        <b>Google Places</b>
        ${hasG ? html`<span class="ok-tag"><i class="fa-solid fa-circle-check"></i> Activée</span>` : html`<span class="muted xs">Photos, avis, horaires</span>`}
      </div>
      <div class="muted small mb">${hasG
        ? 'Les photos, avis et horaires des lieux et des hôtels viennent de Google. La clé est partagée avec l’autre téléphone.'
        : 'Sans clé, les photos viennent de Wikipédia. Avec une clé « Places API (New) » de Google Cloud, presque tous les lieux et hôtels ont une photo.'}</div>
      ${hasG
        ? html`<${Button} small variant="ghost" title="Retirer la clé" onClick=${() => (setGoogleKey(null), pushKey('google', null), setHasG(false))} />`
        : html`<div class="row">
            <input class="input grow" style="margin:0" type="password" placeholder="AIza…" value=${gkey} onInput=${(e) => setGkey(e.target.value)} autocomplete="off" />
            <${Button} small title="OK" disabled=${!gkey} onClick=${() => (setGoogleKey(gkey.trim()), pushKey('google', gkey.trim()), setGkey(''), setHasG(true), toast('Clé Google enregistrée'))} />
          </div>`}
    </${Card}>

    <${SafetyBox} title="Installer sur l'écran d'accueil" icon="mobile-screen">
      <p>Dans Safari : bouton Partager <b>⬆︎</b> › « Sur l'écran d'accueil ». L'app s'ouvre alors en plein écran, avec son icône, même hors-ligne.</p>
    </${SafetyBox}>
    <div class="muted xs center">Carnet de Voyage · version 5.0.2</div>
  </div>`;
}
