// Journal de bord : une note et une photo par moment fort, partagées entre les deux téléphones.
// Les photos sont réduites (~100 Ko) pour tenir dans la base gratuite.
import { html, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { store, useCollection } from '../core/store.js';
import { tripDays, formatDay, toISO } from '../lib/dates.js';
import { Card, Button, Icon, Subtitle, Empty, MemberBadge } from '../ui/components.js';
import { confirm, toast } from '../ui/dialogs.js';

async function compress(file, max = 900, quality = 0.55) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

export default function JournalView() {
  const { trip, path, memberId, members } = useApp();
  const { items } = useCollection(path('journal'), (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await compress(f));
    } catch {
      toast('Photo illisible');
    }
    setBusy(false);
  };

  const save = async () => {
    if (!text.trim() && !photo) return;
    await store.add(path('journal'), { text: text.trim(), photo, day: toISO(new Date()), author: memberId, createdAtMs: Date.now() });
    setText('');
    setPhoto(null);
  };

  const days = tripDays(trip);
  const groups = [...new Set(items.map((i) => i.day))];

  return html`<div class="page">
    <${Card}>
      <textarea class="input" placeholder="Le moment fort de la journée…" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      ${photo ? html`<img src=${photo} class="photo" style="max-height:220px" alt="" />` : null}
      <div class="row">
        <label class="btn ghost icon" style="margin:0"><${Icon} name="camera" /><input type="file" accept="image/*" capture="environment" hidden onChange=${pick} /></label>
        <label class="btn ghost icon" style="margin:0"><${Icon} name="images" /><input type="file" accept="image/*" hidden onChange=${pick} /></label>
        <${Button} cls="grow" title="Épingler" icon="thumbtack" onClick=${save} loading=${busy} style="margin:0" />
      </div>
    </${Card}>
    ${items.length === 0 ? html`<${Empty} icon="book-open" text="Aucun souvenir pour l'instant. Le soir, épinglez une photo et une phrase !" />` : null}
    ${groups.map((g) => {
      const d = days.find((x) => x.iso === g);
      return html`<${Subtitle}>${d ? `Jour ${d.index} · ` : ''}${g ? formatDay(g) : ''}</${Subtitle}>
        ${items
          .filter((i) => i.day === g)
          .map(
            (i) => html`<${Card}>
              ${i.photo ? html`<img src=${i.photo} class="photo" alt="" />` : null}
              ${i.text ? html`<div>${i.text}</div>` : null}
              <div class="row between mt">
                <div class="row">
                  ${members[i.author] ? html`<${MemberBadge} member=${members[i.author]} size=${20} />` : null}
                  <span class="muted xs">${new Date(i.createdAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                ${i.author === memberId
                  ? html`<button class="iconbtn small" onClick=${async () => (await confirm('Supprimer ce souvenir ?', '', 'Supprimer')) && store.remove(`${path('journal')}/${i.id}`)}><${Icon} name="trash-can" /></button>`
                  : null}
              </div>
            </${Card}>`
          )}`;
    })}
  </div>`;
}
