// Voyageurs du voyage en cours : adultes, enfants (âge), bébé, chien… Le guide et l'assistant s'adaptent.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store } from '../core/store.js';
import { ls } from '../core/config.js';
import { KINDS, kindOf, getParty, rememberParty } from '../lib/party.js';
import { Card, Button, Chip, Icon, Subtitle, Switch } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';

export default function TravelersView() {
  const { trip, tripId } = useApp();
  const [party, setParty] = useState(() => getParty(trip));
  const [notes, setNotes] = useState(ls.get('partyNotes', ''));
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setParty(getParty(trip));
  }, [trip?.party]);

  const edit = (i, patch) => {
    setParty(party.map((t, j) => (j === i ? { ...t, ...patch } : t)));
    setDirty(true);
  };
  const add = (kind) => {
    setParty([...party, { kind, name: '', ...(kind === 'enfant' ? { age: 3 } : {}) }]);
    setDirty(true);
  };
  const remove = (i) => {
    setParty(party.filter((_, j) => j !== i));
    setDirty(true);
  };
  const save = async () => {
    const clean = party.map((t) => ({ ...t, name: (t.name || '').trim(), age: t.age === '' ? null : t.age ?? null }));
    if (tripId) await store.update(`trips/${tripId}`, { party: clean });
    rememberParty(clean);
    ls.set('partyNotes', notes.trim());
    setDirty(false);
    toast('Voyageurs enregistrés : le guide et l’assistant s’adaptent');
  };

  return html`<div class="page">
    <h2 class="title">Qui part ?</h2>
    <div class="muted small mb">Pour « ${trip?.name || 'ce voyage'} ». Le guide de visite, l'assistant et les conseils s'adaptent à votre groupe.</div>

    ${party.map(
      (t, i) => html`<${Card}>
        <div class="row">
          <span class="trav-ico"><${Icon} name=${kindOf(t.kind).icon} /></span>
          <input class="input grow" style="margin:0" placeholder=${t.kind === 'chien' ? 'Nom du chien' : 'Prénom'} value=${t.name || ''} onInput=${(e) => edit(i, { name: e.target.value })} />
          <button class="iconbtn" onClick=${() => remove(i)} aria-label="Retirer"><${Icon} name="xmark" /></button>
        </div>
        <div class="chips wrap mt">${KINDS.map((k) => html`<${Chip} label=${k.label} active=${t.kind === k.id} onClick=${() => edit(i, { kind: k.id })} />`)}</div>
        ${t.kind === 'enfant' || t.kind === 'bebe'
          ? html`<div class="row mt"><span class="small grow">${t.kind === 'bebe' ? 'Âge (mois)' : 'Âge (ans)'}</span>
              <button class="iconbtn" onClick=${() => edit(i, { age: Math.max(0, (Number(t.age) || 0) - 1) })}><${Icon} name="minus" /></button>
              <b style="min-width:24px;text-align:center">${t.age ?? 0}</b>
              <button class="iconbtn" onClick=${() => edit(i, { age: (Number(t.age) || 0) + 1 })}><${Icon} name="plus" /></button></div>`
          : null}
        ${t.kind === 'adulte'
          ? html`<div class="row between mt"><span class="small">Enceinte</span><${Switch} checked=${!!t.pregnant} onChange=${(v) => edit(i, { pregnant: v })} /></div>
              <div class="row between mt"><span class="small">Mobilité réduite</span><${Switch} checked=${!!t.mobility} onChange=${(v) => edit(i, { mobility: v })} /></div>`
          : null}
        ${t.kind === 'chien'
          ? html`<div class="chips mt">${['petit', 'moyen', 'grand'].map((sz) => html`<${Chip} label=${sz} active=${t.size === sz} onClick=${() => edit(i, { size: sz })} />`)}</div>`
          : null}
      </${Card}>`
    )}

    <${Subtitle}>Ajouter</${Subtitle}>
    <div class="chips wrap mb">${KINDS.map((k) => html`<${Chip} label=${k.label} icon=${k.icon} onClick=${() => add(k.id)} />`)}</div>

    <${Subtitle}>Besoins particuliers (facultatif)</${Subtitle}>
    <textarea class="input" placeholder="Ex. allergie aux arachides, sieste de 13 h à 15 h, pas d'escaliers…" value=${notes} onInput=${(e) => (setNotes(e.target.value), setDirty(true))}></textarea>

    <${Button} title="Enregistrer" icon="check" onClick=${save} disabled=${!dirty} />
  </div>`;
}
