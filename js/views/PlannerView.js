// Planning : boîte à idées partagée + programme jour par jour + optimisation du trajet.
import { html, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { categoryById, CATEGORIES } from '../data/categories.js';
import { tripDays, formatDay, todayIndex, formatShort } from '../lib/dates.js';
import { optimizeOrder, routeLength, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { savePlace, reorder } from '../lib/trips.js';
import { searchAddress } from '../lib/places.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty, Spinner } from '../ui/components.js';
import { actionSheet, toast } from '../ui/dialogs.js';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export default function PlannerView() {
  const { trip, tripId, path, memberId, mode } = useApp();
  const { items: places, fromCache } = useCollection(path('places'));
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [cat, setCat] = useState('loisirs');
  const [busy, setBusy] = useState(false);

  if (!trip) return html`<div class="page"><${Spinner} /></div>`;
  const days = tripDays(trip);
  const sel = selected ?? (todayIndex(trip) || 0); // 0 = boîte à idées
  const ideas = places.filter((p) => !p.day).sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || byOrder(a, b));
  const list = sel === 0 ? ideas : places.filter((p) => p.day === sel).sort(byOrder);
  const start = trip.lodging ? { lat: trip.lodging.lat, lon: trip.lodging.lon } : null;
  const total = sel ? routeLength(list, start) : 0;

  const moveTo = async (p) => {
    const v = await actionSheet(p.name, 'Déplacer vers :', [
      ...(p.day ? [{ label: 'Boîte à idées', value: 'idea' }] : []),
      ...days.filter((d) => d.index !== p.day).map((d) => ({ label: `Jour ${d.index} · ${formatDay(d.iso)}`, value: d.index })),
    ]);
    if (v === 'idea') savePlace(tripId, p, { day: null });
    else if (v) savePlace(tripId, p, { day: v, order: Date.now() });
  };

  const shift = (i, dir) => {
    const arr = [...list];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    reorder(tripId, arr);
  };

  const optimize = async () => {
    const before = routeLength(list, start);
    const ordered = optimizeOrder(list, start);
    const after = routeLength(ordered, start);
    await reorder(tripId, ordered);
    toast(after < before - 50 ? `Trajet réduit de ${formatDistance(before)} à ${formatDistance(after)} depuis l'hôtel` : "L'ordre était déjà le plus court");
  };

  const add = async () => {
    if (!text.trim()) return;
    setBusy(true);
    let geo = null;
    try {
      geo = (await searchAddress(text, trip.city))[0] || null;
    } catch {
      geo = null;
    }
    await savePlace(
      tripId,
      { name: text.trim(), category: cat, lat: geo?.lat ?? null, lon: geo?.lon ?? null, tags: { street: geo?.address?.split(',').slice(0, 2).join(',') || '' } },
      { day: sel || null },
      memberId
    );
    if (!geo) toast('Ajouté (lieu non trouvé sur la carte)');
    setText('');
    setAdding(false);
    setBusy(false);
  };

  return html`<div class="page">
    <h2 class="title">${trip.name}</h2>
    <div class="muted small">
      ${trip.city?.name} · du ${formatShort(trip.startDate)} au ${formatShort(trip.endDate)}${trip.lodging ? ` · ${trip.lodging.name}` : ''}
    </div>
    ${mode === 'firebase' && fromCache ? html`<div class="muted xs">Hors ligne : dernière copie enregistrée.</div>` : null}

    <div class="chips wrap" style="margin:12px 0">
      <${Chip} label=${`Idées (${ideas.length})`} icon="lightbulb" active=${sel === 0} onClick=${() => setSelected(0)} color="var(--warning)" />
      ${days.map((d) => html`<${Chip} label=${`J${d.index} · ${formatDay(d.iso)}`} active=${sel === d.index} onClick=${() => setSelected(d.index)} color="var(--navy)" />`)}
    </div>

    ${sel === 0
      ? html`<div class="muted small mb">Notre boîte à idées partagée : ajoutez des envies en vrac, puis touchez <${Icon} name="calendar-days" /> pour les placer dans un jour.</div>`
      : html`<div class="row between">
            <div class="subtitle">Jour ${sel} · ${formatDay(days[sel - 1].iso)}</div>
            ${list.length > 1 ? html`<${Button} small variant="accent" icon="route" title="Optimiser" onClick=${optimize} />` : null}
          </div>
          ${list.length && start ? html`<div class="muted small mb">Boucle depuis l'hôtel : ${formatDistance(total)} à vol d'oiseau (≈ ${familyWalkMinutes(total)} min de marche).</div>` : null}
          ${list.length
            ? html`<${SafetyBox} title="Rythme doux" icon="mug-hot"><p>Gardez une pause repos de 14 h à 16 h (hôtel ou café calme) pour Marie et la petite. 2 à 3 lieux par jour suffisent.</p></${SafetyBox}>`
            : null}`}

    ${list.length === 0
      ? html`<${Empty} icon=${sel ? 'calendar' : 'lightbulb'} text=${sel ? 'Rien de prévu ce jour-là. Ajoutez des lieux depuis la boîte à idées ou la carte.' : 'La boîte à idées est vide.'} />`
      : null}

    ${list.map((p, i) => {
      const c = categoryById(p.category);
      return html`<${Card} style="padding:10px 12px">
        <div class="row">
          ${sel ? html`<span class="num">${i + 1}</span>` : html`<${Icon} name=${c.icon} style=${`color:${c.color};width:22px;text-align:center`} />`}
          <div class="grow" onClick=${() => go('lieu', { place: p })} style="cursor:pointer">
            <div class=${`bold ${p.status === 'visited' ? 'strike' : ''}`}>${p.favorite ? '❤️ ' : ''}${p.name}</div>
            <div class="muted xs">${c.label}${p.status === 'visited' ? ' · Visité' : ''}${p.lat == null ? ' · sans position' : ''}</div>
          </div>
          ${sel
            ? html`<button class="iconbtn" onClick=${() => shift(i, -1)} aria-label="Monter"><${Icon} name="chevron-up" /></button>
                <button class="iconbtn" onClick=${() => shift(i, 1)} aria-label="Descendre"><${Icon} name="chevron-down" /></button>`
            : null}
          <button class="iconbtn" style=${p.status === 'visited' ? 'color:var(--success)' : ''} onClick=${() => savePlace(tripId, p, { status: p.status === 'visited' ? 'todo' : 'visited' })} aria-label="Visité">
            <${Icon} name=${p.status === 'visited' ? 'circle-check' : 'circle'} />
          </button>
          <button class="iconbtn" style="color:var(--cyan)" onClick=${() => moveTo(p)} aria-label="Déplacer"><${Icon} name="calendar-days" /></button>
        </div>
      </${Card}>`;
    })}

    ${adding
      ? html`<${Card}>
          <input class="input" placeholder="Ex. « Hamleys », « goûter Borough Market »" value=${text} onInput=${(e) => setText(e.target.value)} autofocus />
          <div class="chips wrap mb">${CATEGORIES.map((c) => html`<${Chip} label=${c.label} icon=${c.icon} active=${cat === c.id} color=${c.color} onClick=${() => setCat(c.id)} />`)}</div>
          <div class="muted xs mb">L'app cherche automatiquement le lieu pour le placer sur la carte.</div>
          <div class="row">
            <${Button} cls="grow" title="Ajouter" icon="plus" onClick=${add} loading=${busy} />
            <${Button} cls="grow" title="Annuler" variant="ghost" onClick=${() => setAdding(false)} />
          </div>
        </${Card}>`
      : html`<${Button} title=${sel ? `Ajouter au jour ${sel}` : 'Nouvelle idée'} icon="plus" onClick=${() => setAdding(true)} />`}

    ${trip.notes ? html`<${Card} style="margin-top:12px"><div class="row"><${Icon} name="circle-info" style="color:var(--cyan)" /><div class="grow small">${trip.notes}</div></div></${Card}>` : null}
  </div>`;
}
