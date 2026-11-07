// Planning : boîte à idées partagée + programme jour par jour + optimisation du trajet.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { categoryById, CATEGORIES } from '../data/categories.js';
import { tripDays, formatDay, todayIndex, formatShort, dayColor, normTime } from '../lib/dates.js';
import { cityPhoto } from '../lib/photos.js';
import { optimizeOrder, routeLength, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { savePlace, reorder, removePlace } from '../lib/trips.js';
import { searchAddress } from '../lib/places.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty, Spinner, Thumb } from '../ui/components.js';
import { actionSheet, toast, confirm } from '../ui/dialogs.js';
import { proposePlanning, applyPlanning, refinePlanning, locateNear } from '../lib/aiPlanner.js';
import { distanceMeters } from '../lib/geo.js';
import { store } from '../core/store.js';
import TimeField from '../ui/TimeField.js';
import TravelLeg from '../ui/TravelLeg.js';
import { hasAI } from '../lib/assistant.js';
import { getParty } from '../lib/party.js';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const toMin = (t) => {
  const n = normTime(t);
  return n ? +n.slice(0, 2) * 60 + +n.slice(3) : null;
};


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
  const [aiStep, setAiStep] = useState('');
  const [fixing, setFixing] = useState(false);
  const [applying, setApplying] = useState(null);
  const [ask, setAsk] = useState('');
  const [chat, setChat] = useState([]); // demandes d'ajustement déjà faites
  const [refining, setRefining] = useState(false);
  const [fromCurrent, setFromCurrent] = useState(false); // on retouche le planning déjà en place
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
    // Les créneaux horaires restent dans l'ordre de la journée : le 1er lieu prend la 1re heure, etc.
    const slots = list.map((x) => normTime(x.time)).filter(Boolean).sort();
    if (slots.length === list.length) await Promise.all(ordered.map((x, i) => (normTime(x.time) !== slots[i] ? savePlace(tripId, x, { time: slots[i] }) : null)));
    toast(after < before - 50 ? `Trajet réduit de ${formatDistance(before)} à ${formatDistance(after)} depuis l'hôtel` : "L'ordre était déjà le plus court");
  };

  const propose = async () => {
    if (!hasAI()) return toast('Ajoutez une clé Gemini ou Groq dans Réglages');
    setAiBusy(true);
    setProposal(null);
    try {
      setProposal(await proposePlanning(trip, places, wishes, (a, b, n) => setAiStep(n > 5 ? `jours ${a} à ${b} sur ${n}` : '')));
      setChat([]);
      setFromCurrent(false);
    } catch (e) {
      toast(e.message);
    }
    setAiBusy(false);
  };
  const planned = places.filter((p) => p.day);
  // Le planning en place, sous la même forme qu'une proposition de l'IA, pour le retoucher par le chat.
  const currentPlan = () => ({
    days: days.map((d) => ({
      day: d.index,
      theme: trip.dayThemes?.[d.index] || '',
      items: places
        .filter((p) => p.day === d.index)
        .sort(byOrder)
        .map((p) => ({ name: p.name, id: p.id, category: p.category, time: normTime(p.time), note: p.aiNote || '' })),
    })),
    tips: trip.aiTips || [],
  });
  const openAI = (q) => {
    if (planned.length) {
      const base = currentPlan();
      setProposal(base);
      setFromCurrent(true);
      setChat([]);
      if (q) refine(null, q, base, []);
    } else setProposal(null);
    setAiOpen(true);
  };
  const refine = async (e, preset, base, hist) => {
    e?.preventDefault();
    const q = (preset || ask).trim();
    if (!q || refining) return;
    if (!hasAI()) return toast('Ajoutez une clé Gemini ou Groq dans Réglages');
    setRefining(true);
    try {
      const h = hist || chat;
      setProposal(await refinePlanning(trip, places, base || proposal, q, h));
      setChat([...h, q]);
      setAsk('');
    } catch (err) {
      toast(err.message);
    }
    setRefining(false);
  };
  // Lieu placé très loin de l'hébergement (homonyme dans une autre région / un autre pays).
  const home = trip.lodging?.lat ? trip.lodging : trip.city;
  const farKm = (p) => (p.lat != null && home?.lat != null ? Math.round(distanceMeters(home, p) / 1000) : 0);
  const fixPlace = async (p) => {
    const f = await locateNear(p.name, trip);
    if (f) {
      await savePlace(tripId, p, { lat: f.lat, lon: f.lon, googleId: f.googleId || null, gphoto: f.gphoto || null, tags: f.tags || {}, ...(f.rating ? { rating: f.rating, ratings: f.ratings } : {}) });
      toast(`Replacé : ${f.name}, à ${Math.round(distanceMeters(home, f) / 1000)} km`);
    } else {
      await savePlace(tripId, p, { lat: null, lon: null, googleId: null, gphoto: null });
      toast(p.lat == null ? 'Introuvable près de l’hébergement : cherchez-le sur la carte (Rechercher) ou supprimez-le' : 'Introuvable sur place : position retirée. Cherchez-le sur la carte (Rechercher) ou supprimez-le');
    }
  };
  const setTripTime = (k, v) => store.update(`trips/${tripId}`, { [k]: normTime(v) });
  // Nouvelle heure d'un lieu : on l'enregistre puis on remet la journée dans l'ordre des heures
  // (un lieu sans heure reste juste après celui qui le précède).
  const setPlaceTime = async (p, t) => {
    await savePlace(tripId, p, { time: t });
    let last = -1;
    const keyed = list.map((x, i) => {
      const m = toMin(x.id === p.id ? t : x.time);
      if (m != null) last = m;
      return { x, k: m ?? last, i };
    });
    const sorted = [...keyed].sort((a, b) => a.k - b.k || a.i - b.i).map((e) => e.x);
    if (sorted.some((x, i) => x.id !== list[i].id)) await reorder(tripId, sorted);
  };
  const apply = async () => {
    if (!fromCurrent && planned.length && !(await confirm('Appliquer ce planning ?', `Les lieux proposés seront placés dans leurs jours. Vos ${planned.length} lieu(x) déjà planifié(s) non repris resteront à leur place.`, 'Appliquer'))) return;
    setApplying([0, 1]);
    try {
      await applyPlanning(trip, tripId, places, proposal, memberId, (d, t) => setApplying([d, t]), { unplanMissing: fromCurrent });
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
          <div class="row between mb"><b><${Icon} name="wand-magic-sparkles" /> ${fromCurrent ? 'Modifier mon planning avec l’IA' : 'Planning proposé par l’IA'}</b><button class="iconbtn" onClick=${() => (setAiOpen(false), setProposal(null), setFromCurrent(false))}><${Icon} name="xmark" /></button></div>
          <div class="muted small mb">Pour : ${getParty(trip).map((t) => `${t.name || { adulte: 'Adulte', enfant: 'Enfant', bebe: 'Bébé', chien: 'Chien', chat: 'Chat' }[t.kind] || ''}${t.kind === 'enfant' && t.age ? ` (${t.age} ans)` : ''}${t.pregnant ? ' 🤰' : ''}`).join(', ')} · <a href="#/voyageurs">modifier</a></div>
          <div class="timesrow">
            <label><span><${Icon} name="bed" /> Arrivée à l'hébergement (jour 1)</span><${TimeField} cls="input" value=${trip.arrivalTime} onSave=${(t) => setTripTime('arrivalTime', t)} placeholder="--:--" /></label>
            <label><span><${Icon} name="suitcase-rolling" /> Quitter l'hébergement (dernier jour)</span><${TimeField} cls="input" value=${trip.departureTime} onSave=${(t) => setTripTime('departureTime', t)} placeholder="--:--" /></label>
          </div>
          ${fromCurrent ? html`<div class="muted small mb">Voici votre planning actuel. Demandez juste ce qu’il faut changer : l’IA garde tout le reste, puis vous validez.</div>` : null}
          ${fromCurrent ? null : html`<textarea class="input" placeholder="Envies (facultatif) : ex. Harry Potter, marchés de Noël, pas de musée le dimanche…" value=${wishes} onInput=${(e) => setWishes(e.target.value)}></textarea>`}
          ${!proposal ? html`<${Button} title=${aiBusy ? `L’IA prépare votre planning${aiStep ? ` (${aiStep})` : ''}…` : 'Proposer un planning'} icon="wand-magic-sparkles" variant="accent" loading=${aiBusy} onClick=${propose} />` : null}
          ${proposal
            ? html`<div class="mt">
                ${proposal.days.map(
                  (d) => html`<div class="aiday">
                    <div class="aiday-h" style=${`--c:${dayColor(d.day)}`}><b>Jour ${d.day}</b> · ${formatDay(days[d.day - 1]?.iso)}${d.theme ? html` — <span>${d.theme}</span>` : null}</div>
                    ${d.items.map((it) => html`<div class="aiitem"><span class="aitime">${it.time || ''}</span><div class="grow"><b>${it.name}</b>${it.id ? html` <span class="ai-tag">idée</span>` : null}${it.note ? html`<div class="muted xs">${it.note}</div>` : null}</div></div>`)}
                  </div>`
                )}
                ${proposal.tips?.length ? html`<div class="muted small mt">${proposal.tips.map((t) => html`<div>• ${t}</div>`)}</div>` : null}
                <div class="aichat">
                  <div class="small bold"><${Icon} name="comments" /> ${fromCurrent ? 'Que voulez-vous changer ?' : 'Presque bien ? Demandez une retouche'}</div>
                  ${chat.map((q) => html`<div class="aichat-q"><${Icon} name="check" /> ${q}</div>`)}
                  <form class="row" onSubmit=${refine}>
                    <input class="input grow" style="margin:0" placeholder=${fromCurrent ? 'Ex. décale le jour 1 après notre arrivée, alléger le jour 2…' : 'Ex. alléger le jour 2, Big Ben vers 17 h, fish & chips mardi…'} value=${ask} onInput=${(e) => setAsk(e.target.value)} disabled=${refining} />
                    <button class="iconbtn send" type="submit" aria-label="Envoyer" disabled=${refining || !ask.trim()}>${refining ? html`<${Icon} name="spinner" cls="fa-spin" />` : html`<${Icon} name="paper-plane" />`}</button>
                  </form>
                  ${refining ? html`<div class="muted xs">L’IA ajuste le planning…</div>` : null}
                </div>
                ${applying
                  ? html`<div class="small mt">Placement des lieux… ${applying[0]} / ${applying[1]}</div><div class="bar"><div style=${`width:${(applying[0] / applying[1]) * 100}%;background:var(--navy)`}></div></div>`
                  : html`<div class="row mt">
                      ${fromCurrent && !chat.length ? null : html`<${Button} cls="grow" title=${fromCurrent ? 'Appliquer les retouches' : 'Appliquer'} icon="check" variant="accent" onClick=${apply} />`}
                      <${Button} cls="grow" title=${fromCurrent ? 'Tout refaire' : 'Autre proposition'} icon="rotate" variant="ghost" onClick=${propose} loading=${aiBusy} />
                    </div>`}
              </div>`
            : null}
        </${Card}>`
      : html`<button class="ai-cta" onClick=${() => openAI()}><${Icon} name="wand-magic-sparkles" /><span>${planned.length
          ? html`<b>Modifier mon planning avec l'IA</b><small>Par chat : alléger un jour, changer une heure, ajouter un resto…</small>`
          : html`<b>Proposer un planning avec l'IA</b><small>Selon vos dates, la ville et votre famille</small>`}</span><${Icon} name="chevron-right" /></button>`}

    ${(() => {
      const far = places.filter((p) => farKm(p) > 40);
      return far.length
        ? html`<div class="farwarn big"><${Icon} name="triangle-exclamation" /><span class="grow">${far.length} lieu${far.length > 1 ? 'x' : ''} placé${far.length > 1 ? 's' : ''} loin de l’hébergement (homonymes ailleurs) : ${far.map((p) => p.name).slice(0, 4).join(', ')}${far.length > 4 ? '…' : ''}</span>
            <button disabled=${fixing} onClick=${async () => { setFixing(true); for (const p of far) await fixPlace(p); setFixing(false); }}>${fixing ? 'Correction…' : 'Tout corriger'}</button></div>`
        : null;
    })()}
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
          ${sel === 1 ? html`<${TravelLeg} trip=${trip} tripId=${tripId} dir="arrivee" key="arr" />` : null}
          ${sel === days.length ? html`<${TravelLeg} trip=${trip} tripId=${tripId} dir="depart" key="dep" />` : null}
          ${(() => {
            const a = toMin(trip.arrivalTime);
            const d = toMin(trip.departureTime);
            const bad = list.filter((p) => {
              const m = toMin(p.time);
              if (m == null) return false;
              return (sel === 1 && a != null && m < a) || (sel === days.length && d != null && m >= d);
            });
            if (!bad.length) return null;
            const arr = sel === 1 && a != null && bad.some((p) => toMin(p.time) < a);
            const q = arr
              ? `Nous arrivons à l'hébergement à ${trip.arrivalTime} le jour 1 : décale les activités du jour 1 après notre arrivée (allège le jour si besoin), ne change pas les autres jours.`
              : `Nous devons quitter l'hébergement à ${trip.departureTime} le dernier jour (jour ${days.length}) : adapte ce jour-là pour finir 30 min avant, près de l'hébergement, ne change pas les autres jours.`;
            return html`<div class="timewarn"><${Icon} name="triangle-exclamation" /><span class="grow">${bad.map((p) => `${p.name} (${normTime(p.time)})`).join(', ')} : ${arr ? `avant votre arrivée à ${normTime(trip.arrivalTime)}` : `après l’heure où quitter l’hébergement (${normTime(trip.departureTime)})`}.</span>
              <button onClick=${() => openAI(q)}><${Icon} name="wand-magic-sparkles" /> Ajuster avec l’IA</button></div>`;
          })()}
          ${list.length && start ? html`<div class="muted small mb">Boucle depuis l'hôtel : ${formatDistance(total)} à vol d'oiseau (≈ ${familyWalkMinutes(total)} min de marche).</div>` : null}
          ${list.length
            ? html`<${SafetyBox} title="Rythme doux" icon="mug-hot"><p>Gardez une pause repos de 14 h à 16 h (hôtel ou café calme) pour reprendre des forces. 2 à 3 lieux par jour suffisent.</p></${SafetyBox}>`
            : null}`}

    ${list.length === 0
      ? html`<${Empty} icon=${sel ? 'calendar' : 'lightbulb'} text=${sel ? 'Rien de prévu ce jour-là. Ajoutez des lieux depuis la boîte à idées ou la carte.' : 'La boîte à idées est vide.'} />
        ${sel ? html`<button class="ai-cta" style="margin-bottom:10px" onClick=${() => go('assistant')}><${Icon} name="shoe-prints" /><span><b>Pas d’idée ? Une petite balade à pied</b><small>L’IA propose des boucles faciles autour de vous</small></span><${Icon} name="chevron-right" /></button>` : null}`
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
            <div class="muted xs">${c.label}${p.status === 'visited' ? ' · Visité' : ''}${p.lat == null && !sel ? ' · sans position' : ''}</div>
            ${sel
              ? html`<label class="ptime" onClick=${(e) => e.stopPropagation()}>
                  <${Icon} name="clock" />
                  <${TimeField} value=${p.time} onSave=${(t) => setPlaceTime(p, t)} placeholder="Heure ?" />
                </label>`
              : null}
            ${p.lat == null && sel
              ? html`<div class="farwarn nopos" onClick=${(e) => e.stopPropagation()}><${Icon} name="location-dot" /> Pas encore sur la carte
                  <button onClick=${() => fixPlace(p)}>Chercher sur place</button></div>`
              : null}
            ${farKm(p) > 40
              ? html`<div class="farwarn" onClick=${(e) => e.stopPropagation()}><${Icon} name="triangle-exclamation" /> Placé à ${farKm(p)} km de l’hébergement : sûrement le mauvais lieu
                  <button onClick=${() => fixPlace(p)}>Corriger</button></div>`
              : null}
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
          <button class="iconbtn" style="color:var(--muted)" aria-label="Supprimer"
            onClick=${async () => (await confirm(`Supprimer « ${p.name} » ?`, 'Le lieu sera retiré du voyage sur les deux téléphones.', 'Supprimer')) && (await removePlace(tripId, p.id), toast('Lieu supprimé'))}><${Icon} name="trash-can" /></button>
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

  </div>`;
}
