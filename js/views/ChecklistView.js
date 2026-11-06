// Check-list collaborative : cochée sur un téléphone, cochée sur l'autre.
import { html, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useCollection } from '../core/store.js';
import { Card, Button, Chip, Icon, Subtitle } from '../ui/components.js';
import { confirm, toast } from '../ui/dialogs.js';
import { askAI, hasAI } from '../lib/assistant.js';
import { getParty, describeParty } from '../lib/party.js';

export default function ChecklistView() {
  const { path, memberId, members, trip } = useApp();
  const [aiBusy, setAiBusy] = useState(false);
  const { items } = useCollection(path('checklist'), (a, b) => (a.order ?? 0) - (b.order ?? 0));
  const [text, setText] = useState('');
  const [section, setSection] = useState('Pratique');
  const [hideDone, setHideDone] = useState(false);
  const sections = [...new Set(items.map((i) => i.section))];
  const done = items.filter((i) => i.done).length;

  const toggle = (i) => store.update(`${path('checklist')}/${i.id}`, { done: !i.done, doneBy: !i.done ? memberId : null });
  const add = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    store.add(path('checklist'), { label: text.trim(), section, done: false, order: Date.now(), createdBy: memberId });
    setText('');
  };

  // L'IA complète la liste avec les formalités et les choses utiles qu'on ne pense pas à vérifier.
  const askChecklist = async () => {
    if (!hasAI()) return toast('Ajoutez une clé Gemini ou Groq dans Réglages');
    setAiBusy(true);
    try {
      const dest = `${trip?.city?.name || 'la destination'}${trip?.city?.country ? ` (${trip.city.country})` : ''}`;
      const when = trip?.startDate ? ` du ${trip.startDate} au ${trip.endDate}` : '';
      const existing = items.map((i) => i.label).join(' ; ');
      const question = `Famille française (départ de France) qui part à ${dest}${when}. ${describeParty(getParty(trip))}
Liste ce qu'il est IMPORTANT de savoir ou de faire avant de partir et qu'on ne connaît pas forcément : visa / autorisation électronique (ETA, ESTA…) et délais, validité des papiers (passeport ou carte d'identité, enfants compris, autorisation de sortie de territoire), santé (vaccins, assurance, carte européenne, médicaments), conduite (permis, vignette, péage, Crit'Air, siège auto), argent (devise, pourboires, carte), prises électriques, numéro d'urgence, règles locales surprenantes, animaux si besoin, météo de la saison.
Uniquement ce qui s'applique vraiment à cette destination. Ne répète pas ce qui est déjà dans la liste : ${existing.slice(0, 1500)}
Réponds UNIQUEMENT par 6 à 14 lignes au format exact « Rubrique | Action courte et précise », rubriques parmi : Formalités, Santé, Argent, Transport, Sur place, Grossesse, Enfant, Animal. Si un point est incertain, ajoute « (à vérifier) ».`;
      const text = await askAI({ question, system: 'Tu es un expert des formalités de voyage pour les familles françaises. Tu es précis, factuel et prudent.', max: 900 });
      const known = new Set(items.map((i) => i.label.toLowerCase()));
      const lines = (text || '')
        .split('\n')
        .map((l) => l.replace(/^[-*•\d.\s]+/, '').trim())
        .filter((l) => l.includes('|'))
        .map((l) => l.split('|').map((x) => x.replace(/\*\*/g, '').trim()))
        .filter(([sec, label]) => sec && label && !known.has(label.toLowerCase()));
      if (!lines.length) throw new Error("L'IA n'a rien renvoyé d'exploitable, réessayez.");
      let order = Date.now();
      for (const [sec, label] of lines) await store.add(path('checklist'), { label, section: sec, done: false, order: order++, createdBy: memberId, ai: true });
      toast(`${lines.length} point(s) ajouté(s) par l'IA`);
    } catch (e) {
      toast(e.message);
    }
    setAiBusy(false);
  };

  return html`<div class="page">
    <${Card} cls="ai-check">
      <div class="row">
        <${Icon} name="wand-magic-sparkles" style="color:var(--navy);font-size:22px" />
        <div class="grow"><div class="bold">À savoir avant de partir</div><div class="muted small">L'IA ajoute les formalités (visa, ETA, papiers des enfants…), la santé, la conduite, l'argent et les règles locales propres à ce voyage.</div></div>
      </div>
      <${Button} small title=${aiBusy ? 'Recherche en cours…' : 'Compléter avec l’IA'} icon="wand-magic-sparkles" variant="accent" loading=${aiBusy} onClick=${askChecklist} />
    </${Card}>
    <${Card}>
      <div class="row between">
        <div class="bold" style="font-size:18px">${done} / ${items.length} prêts</div>
        <${Chip} label="Masquer les faits" active=${hideDone} onClick=${() => setHideDone(!hideDone)} />
      </div>
      <div class="bar"><div style=${`width:${items.length ? (done / items.length) * 100 : 0}%;background:var(--success)`}></div></div>
    </${Card}>
    ${sections.map(
      (s) => html`<${Subtitle}>${s}</${Subtitle}>
        <${Card} style="padding:2px 14px">
          ${items
            .filter((i) => i.section === s && (!hideDone || !i.done))
            .map(
              (i) => html`<div class="list-item">
                <button class="iconbtn" style=${`font-size:21px;color:${i.done ? 'var(--success)' : 'var(--muted)'}`} onClick=${() => toggle(i)}>
                  <i class=${i.done ? 'fa-solid fa-square-check' : 'fa-regular fa-square'}></i>
                </button>
                <span class=${`grow ${i.done ? 'strike' : ''}`} onClick=${() => toggle(i)}>${i.label}${i.ai ? html` <span class="ai-tag">IA</span>` : null}</span>
                ${i.done && members[i.doneBy] ? html`<b style=${`color:${members[i.doneBy].color}`}>${i.doneBy}</b>` : null}
                <button class="iconbtn small" onClick=${async () => (await confirm('Supprimer ?', i.label, 'Supprimer')) && store.remove(`${path('checklist')}/${i.id}`)}>
                  <${Icon} name="xmark" />
                </button>
              </div>`
            )}
        </${Card}>`
    )}
    <${Subtitle}>Ajouter</${Subtitle}>
    <div class="chips wrap mb">${[...new Set([...sections, 'Pratique'])].map((s) => html`<${Chip} label=${s} active=${section === s} onClick=${() => setSection(s)} />`)}</div>
    <form onSubmit=${add}>
      <input class="input" placeholder="Ex. Crème hydratante, pyjama licorne…" value=${text} onInput=${(e) => setText(e.target.value)} />
      <${Button} title="Ajouter" icon="plus" />
    </form>
  </div>`;
}
