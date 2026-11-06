// Coffre-fort : billets, QR codes, PDF, confirmations. Face ID ou code à chaque ouverture.
// Fichiers chiffrés (AES-256) et stockés uniquement sur ce téléphone, lisibles hors-ligne.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { listDocs, addFile, addBooking, removeDoc, openFile, useSharedVault, onVaultChange } from '../core/vault.js';
import { useApp } from '../core/app.js';
import { ls } from '../core/config.js';
import { pushKey } from '../core/sharedKeys.js';
import { biometricsEnabled, verifyBiometrics, checkPin, pinLength } from '../core/lock.js';
import { parseBooking, KIND_LABELS } from '../lib/bookingParser.js';
import PinPad from '../ui/PinPad.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty } from '../ui/components.js';
import { confirm, toast } from '../ui/dialogs.js';

const KINDS = ['vol', 'train', 'hebergement', 'activite', 'autre'];

export default function VaultView() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [docs, setDocs] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('vol');
  const bio = biometricsEnabled();
  const len = pinLength();

  const { mode, user, tripId } = useApp();
  // Coffre commun : rangé dans un voyage « maison » fixe, pour retrouver passeports et billets partout.
  let home = null;
  if (mode === 'firebase' && user && tripId) {
    home = ls.get('vaultTrip', null);
    if (!home) {
      home = tripId;
      ls.set('vaultTrip', home);
      pushKey('vaultTrip', home);
    }
  }
  const sharedPath = home ? `trips/${home}/meta` : null;
  const refresh = async () => setDocs(await listDocs());
  useEffect(() => {
    if (!open) return undefined;
    const stop = useSharedVault(sharedPath);
    const off = onVaultChange(refresh);
    refresh();
    return () => {
      off();
      stop();
    };
  }, [open, sharedPath]);
  useEffect(() => () => viewer && URL.revokeObjectURL(viewer.url), []);

  const faceId = async () => (await verifyBiometrics()) && setOpen(true);
  const onPin = async (v) => {
    setPin(v);
    if (v.length < len) return;
    if (await checkPin(v)) setOpen(true);
    else toast('Code incorrect');
    setPin('');
  };

  const importFile = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    try {
      for (const f of files) await addFile(f, { title: files.length === 1 && title ? title : f.name.replace(/\.[^.]+$/, ''), kind });
      toast(sharedPath ? `${files.length} document(s) chiffré(s) et partagé(s) avec l'autre téléphone` : `${files.length} document(s) chiffré(s) et rangé(s)`);
    } catch (err) {
      toast(err.message);
    }
    setTitle('');
    refresh();
  };

  const saveBooking = async () => {
    await addBooking({ ...parsed, title: title || KIND_LABELS[parsed.kind]?.label, raw });
    setParsing(false);
    setRaw('');
    setParsed(null);
    setTitle('');
    refresh();
  };

  const show = async (d) => {
    try {
      setViewer({ ...d, url: await openFile(d.id) });
    } catch (e) {
      toast(e.message);
    }
  };
  const close = () => {
    URL.revokeObjectURL(viewer.url);
    setViewer(null);
  };

  if (!open)
    return html`<div class="lock" style="padding-top:30px">
      <div style="font-size:44px;color:var(--cyan)"><${Icon} name="lock" /></div>
      <h2 class="title">Coffre-fort verrouillé</h2>
      ${bio ? html`<${Button} title="Ouvrir avec Face ID" icon="face-smile" onClick=${faceId} style="max-width:320px" />` : null}
      <div class="muted small mt">${bio ? 'ou saisissez votre code' : 'Saisissez votre code'}</div>
      <${PinPad} value=${pin} length=${len} onChange=${onPin} onBiometrics=${bio ? faceId : null} />
    </div>`;

  const groups = [...KINDS, 'reservation'].map((k) => [k, docs.filter((d) => (d.kind || 'autre') === k)]).filter(([, l]) => l.length);

  return html`<div class="page">
    <${SafetyBox} title="Sécurité des documents" icon="shield-halved">
      ${sharedPath
        ? html`<p><b>Coffre commun</b> : ce que l'un ajoute apparaît chez l'autre. Les fichiers sont chiffrés (AES-256) sur le téléphone avant d'être envoyés : seuls vos deux téléphones peuvent les lire, et ils restent disponibles hors-ligne.</p>`
        : html`<p>Vos fichiers sont chiffrés (AES-256) et restent sur ce téléphone. Activez la synchronisation pour partager le coffre avec l'autre téléphone.</p>`}
    </${SafetyBox}>

    <${Subtitle}>Ajouter</${Subtitle}>
    <${Card}>
      <input class="input" placeholder="Titre (ex. Vol aller EZY8541)" value=${title} onInput=${(e) => setTitle(e.target.value)} />
      <div class="chips wrap mb">${KINDS.map((k) => html`<${Chip} label=${KIND_LABELS[k].label} icon=${KIND_LABELS[k].icon} active=${kind === k} onClick=${() => setKind(k)} />`)}</div>
      <div class="row">
        <label class="btn sm grow" style="margin:0"><${Icon} name="image" />Photo / QR<input type="file" accept="image/*" multiple hidden onChange=${importFile} /></label>
        <label class="btn sm grow" style="margin:0"><${Icon} name="file-pdf" />PDF<input type="file" accept="application/pdf,image/*" multiple hidden onChange=${importFile} /></label>
        <button class="btn sm accent grow" style="margin:0" onClick=${() => setParsing(true)}><${Icon} name="wand-magic-sparkles" />Analyser</button>
      </div>
    </${Card}>

    ${parsing
      ? html`<${Card}>
          <div class="bold mb">Collez le texte de votre email de confirmation</div>
          <textarea class="input" style="min-height:120px" value=${raw} onInput=${(e) => setRaw(e.target.value)} placeholder="Votre référence de réservation : …"></textarea>
          <${Button} title="Analyser" icon="wand-magic-sparkles" disabled=${!raw} onClick=${() => setParsed(parseBooking(raw))} />
          ${parsed
            ? html`<div class="mt">
                ${[
                  ['Type', KIND_LABELS[parsed.kind]?.label],
                  ['Référence', parsed.reference],
                  ['Vols', parsed.flights.join(', ')],
                  ['Dates', parsed.dates.join(', ')],
                  ['Heures', parsed.times.join(', ')],
                  ['Montant', parsed.price],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => html`<div class="row" style="padding:3px 0"><span class="muted" style="width:90px">${k}</span><span class="bold grow">${v}</span></div>`)}
                <${Button} title="Enregistrer dans le coffre" icon="floppy-disk" variant="accent" onClick=${saveBooking} />
              </div>`
            : null}
          <${Button} title="Fermer" variant="ghost" small onClick=${() => (setParsing(false), setParsed(null))} />
        </${Card}>`
      : null}

    ${docs.length === 0 ? html`<${Empty} icon="folder-open" text="Aucun document pour l'instant." />` : null}
    ${groups.map(
      ([k, list]) => html`<${Subtitle}>${KIND_LABELS[k].label}</${Subtitle}>
        ${list.map(
          (d) => html`<${Card} onClick=${d.hasFile ? () => show(d) : null}>
            <div class="row">
              <${Icon} name=${d.isPdf ? 'file-pdf' : d.isImage ? 'qrcode' : KIND_LABELS[d.kind]?.icon || 'file'} style="color:var(--cyan);font-size:22px;width:26px" />
              <div class="grow">
                <div class="bold">${d.title}</div>
                ${d.reference ? html`<div class="muted small">Réf. ${d.reference}</div>` : null}
                ${d.flights?.length ? html`<div class="muted small">${d.flights.join(' · ')}</div>` : null}
                ${d.dates?.length ? html`<div class="muted small">${d.dates.join(' → ')}${d.times?.length ? ` · ${d.times.join(', ')}` : ''}</div>` : null}
              </div>
              <button
                class="iconbtn"
                onClick=${async (e) => {
                  e.stopPropagation();
                  if (await confirm('Supprimer ce document ?', d.title, 'Supprimer')) {
                    await removeDoc(d.id);
                    refresh();
                  }
                }}
              ><${Icon} name="trash-can" /></button>
            </div>
          </${Card}>`
        )}`
    )}

    ${viewer
      ? html`<div class="viewer">
          <div class="zone">${viewer.isPdf ? html`<iframe src=${viewer.url} title=${viewer.title}></iframe>` : html`<img src=${viewer.url} alt=${viewer.title} />`}</div>
          ${viewer.isImage ? html`<div class="center small" style="color:#555;padding:6px">Astuce : montez la luminosité pour scanner le QR code.</div>` : null}
          <div class="row" style="padding:10px 16px">
            ${viewer.isPdf ? html`<a class="btn ghost grow" href=${viewer.url} target="_blank" style="color:var(--navy)"><${Icon} name="up-right-from-square" />Plein écran</a>` : null}
            <${Button} cls="grow" title="Fermer" icon="xmark" onClick=${close} />
          </div>
        </div>`
      : null}
  </div>`;
}
