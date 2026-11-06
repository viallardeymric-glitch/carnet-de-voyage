// Check-list collaborative : cochée sur un téléphone, cochée sur l'autre.
import { html, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useCollection } from '../core/store.js';
import { Card, Button, Chip, Icon, Subtitle } from '../ui/components.js';
import { confirm } from '../ui/dialogs.js';

export default function ChecklistView() {
  const { path, memberId, members } = useApp();
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

  return html`<div class="page">
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
                <span class=${`grow ${i.done ? 'strike' : ''}`} onClick=${() => toggle(i)}>${i.label}</span>
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
