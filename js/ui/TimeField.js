import { html, useEffect, useState } from '../../vendor/preact.js';
import { normTime } from '../lib/dates.js';

// Champ heure fiable sur iPhone : la roue d'iOS envoie une valeur à chaque cran ; on n'enregistre
// qu'à la fermeture (perte de focus), sinon la synchro réécrit le champ pendant qu'on le tourne.
export default function TimeField({ value, onSave, cls = '', placeholder }) {
  const v = normTime(value) || '';
  const [draft, setDraft] = useState(v);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(v);
  }, [v, editing]);
  const commit = (e) => {
    setEditing(false);
    const n = normTime(e.target.value) || '';
    if (n !== v) onSave(n || null);
  };
  return html`<span class=${`tfield ${cls}`}>
    <input type="time" value=${draft} onFocus=${() => setEditing(true)} onInput=${(e) => setDraft(e.target.value)} onBlur=${commit}
      onKeyDown=${(e) => e.key === 'Enter' && e.target.blur()} />
    ${!draft && placeholder ? html`<span class="tph">${placeholder}</span>` : null}
  </span>`;
}
