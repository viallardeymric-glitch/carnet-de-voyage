// Planning : boîte à idées partagée + programme jour par jour + optimisation du trajet.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { categoryById, CATEGORIES } from '../data/categories.js';
import { tripDays, formatDay, todayIndex, formatShort, dayColor } from '../lib/dates.js';
import { cityPhoto } from '../lib/photos.js';
import { optimizeOrder, routeLength, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { savePlace, reorder } from '../lib/trips.js';
import { searchAddress } from '../lib/places.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty, Spinner, Thumb } from '../ui/components.js';
import { actionSheet, toast, confirm } from '../ui/dialogs.js';
import { proposePlanning, applyPlanning } from '../lib/aiPlanner.js';
import { hasAI } from '../lib/assistant.js';
import { getParty } from '../lib/party.js';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export default function PlannerView() {
  const { trip, tripId, path, memberId, mode } = useApp();
  const { items: places, fromCache } = useCollection(path('places'));
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [cat, setCat] = useState('loisirs');
  const [busy, setBusy] = useState(false);
  const [cover, setCover] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [wishes, setWishes] = useState('');
  const [proposal, setProposal] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [applying, setApplying] = useState(null);
  useEffect(() => {
    if (trip?.city?.name) cityPhoto(trip.city.name).then(setCover);
  }, [trip?.city?.name]);

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

  const propose = async () => {
    if (!hasAI()) return toast('Ajoutez une clé Gemini ou Groq dans Réglages');
    setAiBusy(true);
    setProposal(null);
    try {
      setProposal(await proposePlanning(trip, places, wishes));
    } catch (e) {
      toast(e.message);
    }
    setAiBusy(false);
  };
  const apply = async () => {
    const planned = places.filter((p) => p.day).length;
    if (planned && !(await confirm('Appliquer ce planning ?', `Les lieux proposés seront placés dans leurs jours. Vos ${planned} lieu(x) déjà planifié(s) non repris resteront à leur place.`, 'Appliquer'))) return;
    setApplying([0, 1]);
    try {
      await applyPlanning(trip, tripId, places, proposal, memberId, (d, t) => setApplying([d, t]));
      toast('Planning appliqué : retrouvez-le jour par jour et sur la carte');
      setProposal(null);
      setAiOpen(false);
      setSelected(1);
    } catch (e) {
      toast(e.message);
    }
    setApplying(null);
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
    <div class="cover" style=${cover ? `background-image:linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(0,0,0,.65)),url('${cover}')` : ''}>
      <div class="cover-text">
        <div class="cover-title">${trip.name}</div>
        <div class="cover-sub">${trip.city?.name} · du ${formatShort(trip.startDate)} au ${formatShort(trip.endDate)} · ${places.length} lieux</div>
        ${trip.lodging ? html`<div class="cover-sub"><${Icon} name="bed" /> ${trip.lodging.name}</div>` : null}
      </div>
    </div>
    ${mode === 'firebase' && fromCache ? html`<div class="muted xs">Hors ligne : dernière copie enregistrée.</div>` : null}

    ${aiOpen
      ? html`<${Card} cls="ai-plan">
          <div class="row between mb"><b><${Icon} name="wand-magic-sparkles" /> Planning proposé par l'IA</b><button class="iconbtn" onClick=${() => (setAiOpen(false), setProposal(null))}><${Icon} name="xmark" /></button></div>
          <div class="muted small mb">Pour : ${getParty(trip).map((t) => `${t.name || { adulte: 'Adulte', enfant: 'Enfant', bebe: 'Bébé', chien: 'Chien', chat: 'Chat' }[t.kind] || ''}${t.kind === 'enfant' && t.age ? ` (${t.age} ans)` : ''}${t.pregnant ? ' 🤰' : ''}`).join(', ')} · <a href="#/voyageurs">modifier</a></div>
          <textarea class="input" placeholder="Envies (facultatif) : ex. Harry Potter, marchés de Noël, pas de musée le dimanche…" value=${wishes} onInput=${(e) => setWishes(e.target.value)}></textarea>
          ${!proposal ? html`<${Button} title=${aiBusy ? 'L’IA prépare votre planning…' : 'Proposer un planning'} icon="wand-magic-sparkles" variant="accent" loading=${aiBusy} onClick=${propose} />` : null}
          ${proposal
            ? html`<div class="mt">
                ${proposal.days.map(
                  (d) => html`<div class="aiday">
                    <div class="aiday-h" style=${`--c:${dayColor(d.day)}`}><b>Jour ${d.day}</b> · ${formatDay(days[d.day - 1]?.iso)}${d.theme ? html` — <span>${d.theme}</span>` : null}</div>
                    ${d.items.map((it) => html`<div class="aiitem"><span class="aitime">${it.time || ''}</span><div class="grow"><b>${it.name}</b>${it.id ? html` <span class="ai-tag">idée</span>` : null}${it.note ? html`<div class="muted xs">${it.note}</div>` : null}</div></div>`)}
                  </div>`
                )}
                ${proposal.tips?.length ? html`<div class="muted small mt">${proposal.tips.map((t) => html`<div>• ${t}</div>`)}</div>` : null}
                ${applying
                  ? html`<div class="small mt">Placement des lieux… ${applying[0]} / ${applying[1]}</div><div class="bar"><div style=${`width:${(applying[0] / applying[1]) * 100}%;background:var(--navy)`}></div></div>`
                  : html`<div class="row mt"><${Button} cls="grow" title="Appliquer" icon="check" variant="accent" onClick=${apply} /><${Button} cls="grow" title="Autre proposition" icon="rotate" variant="ghost" onClick=${propose} loading=${aiBusy} /></div>`}
              </div>`
            : null}
        </${Card}>`
      : html`<button class="ai-cta" onClick=${() => setAiOpen(true)}><${Icon} name="wand-magic-sparkles" /><span><b>Proposer un planning avec l'IA</b><small>Selon vos dates, la ville et votre famille</small></span><${Icon} name="chevron-right" /></button>`}

    <div class="chips wrap" style="margin:12px 0">
      <${Chip} label=${`Idées (${ideas.length})`} icon="lightbulb" active=${sel === 0} onClick=${() => setSelected(0)} color="var(--warning)" />
      ${days.map((d) => html`<${Chip} label=${`J${d.index} · ${formatDay(d.iso)}`} active=${sel === d.index} onClick=${() => setSelected(d.index)} color=${dayColor(d.index)} />`)}
    </div>

    ${sel === 0
      ? html`<div class="muted small mb">Notre boîte à idées partagée : ajoutez des envies en vrac, puis touchez <${Icon} name="calendar-days" /> pour les placer dans un jour.</div>`
      : html`<div class="row between">
            <div class="subtitle">Jour ${sel} · ${formatDay(days[sel - 1].iso)}${trip.dayThemes?.[sel] ? ` — ${trip.dayThemes[sel]}` : ''}</div>
            ${list.length > 1 ? html`<${Button} small variant="accent" icon="route" title="Optimiser" onClick=${optimize} />` : null}
          </div>
          ${list.length && start ? html`<div class="muted small mb">Boucle depuis l'hôtel : ${formatDistance(total)} à vol d'oiseau (≈ ${familyWalkMinutes(total)} min de marche).</div>` : null}
          ${list.length
            ? html`<${SafetyBox} title="Rythme doux" icon="mug-hot"><p>Gardez une pause repos de 14 h à 16 h (hôtel ou café calme) pour reprendre des forces. 2 à 3 lieux par jour suffisent.</p></${SafetyBox}>`
            : null}`}

    ${list.length === 0
      ? html`<${Empty} icon=${sel ? 'calendar' : 'lightbulb'} text=${sel ? 'Rien de prévu ce jour-là. Ajoutez des lieux depuis la boîte à idées ou la carte.' : 'La boîte à idées est vide.'} />`
      : null}

    ${list.map((p, i) => {
      const c = categoryById(p.category);
      return html`<${Card} style="padding:10px 12px">
        <div class="row">
          <div class="thumb-wrap" onClick=${() => go('lieu', { place: p })} style="cursor:pointer">
            <${Thumb} place=${p} city=${trip.city?.name} />
            ${sel ? html`<span class="num" style=${`background:${dayColor(sel)}`}>${i + 1}</span>` : null}
          </div>
          <div class="grow" onClick=${() => go('lieu', { place: p })} style="cursor:pointer;min-width:0">
            <div class=${`bold ${p.status === 'visited' ? 'strike' : ''}`}>${p.favorite ? '❤️ ' : ''}${p.name}</div>
            <div class="muted xs">${p.time && sel ? html`<b style="color:var(--navy)">${p.time}</b> · ` : null}${c.label}${p.status === 'visited' ? ' · Visité' : ''}${p.lat == null ? ' · sans position' : ''}</div>
            ${p.aiNote && sel ? html`<div class="xs" style="color:var(--muted);margin-top:2px"><${Icon} name="wand-magic-sparkles" /> ${p.aiNote}</div>` : null}
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
