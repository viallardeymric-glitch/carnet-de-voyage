// Assistant : « que faire maintenant ? » selon l'heure, la météo et ce qui est proche.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { getPosition } from '../core/location.js';
import { getWeather } from '../lib/weather.js';
import { localSuggestions, askClaude, getApiKey, momentOfDay, assistantSystem } from '../lib/assistant.js';
import { getParty, describeParty } from '../lib/party.js';
import { savePlace } from '../lib/trips.js';
import { categoryById } from '../data/categories.js';
import { formatDistance } from '../lib/geo.js';
import { Card, Button, Chip, Icon, Subtitle, Spinner, Thumb } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';
import { proposeWalks, buildWalk } from '../lib/walks.js';
import { distanceMeters } from '../lib/geo.js';

export default function AssistantView() {
  const { trip, tripId, path, memberId } = useApp();
  const { items: places } = useCollection(path('places'));
  const [weather, setWeather] = useState(null);
  const [data, setData] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const hasKey = !!getApiKey();
  const [walks, setWalks] = useState(null);
  const [walkBusy, setWalkBusy] = useState(false);
  const [walkLen, setWalkLen] = useState(60);
  const [going, setGoing] = useState(null);
  const [from, setFrom] = useState(null);

  // Point de départ : ma position si je suis sur place, sinon l'hébergement.
  const startPoint = async () => {
    const me = await getPosition();
    const ref = trip?.lodging || trip?.city;
    if (me && ref && distanceMeters(me, ref) < 30000) return { name: 'Ma position', lat: me.lat, lon: me.lon };
    return trip?.lodging ? { name: trip.lodging.name, lat: trip.lodging.lat, lon: trip.lodging.lon } : { name: trip.city.name, lat: trip.city.lat, lon: trip.city.lon };
  };
  const findWalks = async (len = walkLen, fresh = false) => {
    setWalkBusy(true);
    setWalks(null);
    try {
      const st = await startPoint();
      setFrom(st);
      setWalks(await proposeWalks(trip, st, { weather, minutes: len, fresh }));
    } catch (e) {
      toast(e.message);
    }
    setWalkBusy(false);
  };
  const startWalk = async (w, i) => {
    setGoing(i);
    try {
      const g = await buildWalk(w, from, trip.city);
      sessionStorage.setItem('cdv-guide', JSON.stringify(g));
      go('carte');
    } catch (e) {
      toast(e.message);
    }
    setGoing(null);
  };

  const run = async () => {
    setData(null);
    const pos = (await getPosition()) || trip?.lodging || trip?.city;
    let w = null;
    try {
      w = await getWeather(pos);
    } catch {
      w = null;
    }
    setWeather(w);
    setData(await localSuggestions({ position: pos, weather: w, ideas: places }));
  };
  useEffect(() => {
    if (trip) run();
  }, [trip?.id]);

  const ask = async () => {
    setThinking(true);
    setAnswer('');
    try {
      const context = {
        ville: trip?.city?.name,
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        moment: momentOfDay(),
        meteo: weather,
        hotel: trip?.lodging?.name,
        lieuxProches: data?.places?.slice(0, 5).map((p) => `${p.name} (${formatDistance(p.distance)})`),
        boiteAIdees: places.filter((p) => !p.day).map((p) => p.name).slice(0, 15),
      };
      setAnswer(await askClaude({ question: question || 'Que nous conseilles-tu de faire maintenant ?', context, system: assistantSystem(describeParty(getParty(trip))) }));
    } catch (e) {
      setAnswer(`⚠️ ${e.message}`);
    }
    setThinking(false);
  };

  return html`<div class="page">
    ${weather
      ? html`<${Card} cls="hero">
          <div class="row">
            <${Icon} name=${weather.icon} style="font-size:34px;color:var(--cyan)" />
            <div>
              <div style="font-size:22px;font-weight:800">${weather.temp}°C · ${weather.label}</div>
              <div style="color:rgba(255,255,255,.85)">Min ${weather.min}° / max ${weather.max}°${weather.rainChance != null ? ` · pluie ${weather.rainChance} %` : ''}</div>
            </div>
          </div>
        </${Card}>`
      : null}
    ${!data ? html`<${Spinner} />` : null}
    ${data
      ? html`<${Card}>${data.tips.map((t) => html`<div class="row" style="align-items:flex-start;margin-bottom:6px"><${Icon} name="wand-magic-sparkles" style="color:var(--cyan);margin-top:3px" /><div class="grow">${t}</div></div>`)}</${Card}>
          ${data.ideasNear.length ? html`<${Subtitle}>De notre boîte à idées, tout près</${Subtitle}>` : null}
          ${data.ideasNear.map(
            (p) => html`<${Card} onClick=${() => go('lieu', { place: p })}>
              <div class="row"><${Thumb} place=${p} city=${trip?.city?.name} size=${48} /><div class="grow bold">${p.name}</div><span class="muted small">≈ ${p.walk} min</span></div>
            </${Card}>`
          )}
          <${Subtitle}>Suggestions · ${categoryById(data.category).label}</${Subtitle}>
          ${data.places.length === 0 ? html`<div class="muted small">Rien trouvé à proximité (ou pas de réseau).</div>` : null}
          ${data.places.map((p) => {
            const c = categoryById(p.category);
            return html`<${Card} onClick=${() => go('lieu', { place: p })}>
              <div class="row">
                <${Thumb} place=${p} city=${trip?.city?.name} size=${48} />
                <div class="grow"><div class="bold">${p.name}</div><div class="muted small">${formatDistance(p.distance)} · ≈ ${p.walk} min à pied</div></div>
                <button class="iconbtn" style="color:var(--cyan)" onClick=${(e) => (e.stopPropagation(), savePlace(tripId, p, {}, memberId), toast('Ajouté à la boîte à idées'))}><${Icon} name="plus" /></button>
              </div>
            </${Card}>`;
          })}
          <${Button} title="Actualiser" icon="rotate" variant="ghost" onClick=${run} />`
      : null}

    <${Subtitle}>Une petite balade à pied ?</${Subtitle}>
    <${Card}>
      <div class="muted small mb">Rien de prévu ? L’IA propose 3 boucles faciles autour de vous${from ? ` (départ : ${from.name})` : ''}, puis la carte vous guide étape par étape.</div>
      <div class="chips mb">${[30, 60, 90].map((m) => html`<${Chip} label=${m === 90 ? '1 h 30' : m === 60 ? '1 h' : '30 min'} active=${walkLen === m} onClick=${() => (setWalkLen(m), walks && findWalks(m))} />`)}</div>
      ${!walks ? html`<${Button} title=${walkBusy ? 'L’IA cherche de jolies balades…' : 'Proposer des balades'} icon="shoe-prints" variant="accent" loading=${walkBusy} onClick=${() => findWalks()} />` : null}
      ${walks?.map(
        (w, i) => html`<div class="walk">
          <div class="row between"><b>${w.titre}</b><span class="muted small">≈ ${w.duree_min || walkLen} min</span></div>
          ${w.ambiance ? html`<div class="small">${w.ambiance}</div>` : null}
          <ol class="walksteps">${w.etapes.map((e) => html`<li><b>${e.nom}</b>${e.info ? html` · <span class="muted">${e.info}</span>` : null}</li>`)}</ol>
          ${w.pause ? html`<div class="xs"><${Icon} name="mug-hot" style="color:var(--cyan)" /> ${w.pause}</div>` : null}
          ${w.conseil ? html`<div class="xs muted"><${Icon} name="child" /> ${w.conseil}</div>` : null}
          <${Button} title=${going === i ? 'Préparation du trajet…' : 'C’est parti : voir sur la carte'} icon="map-location-dot" small loading=${going === i} onClick=${() => startWalk(w, i)} />
        </div>`
      )}
      ${walks ? html`<${Button} title="Autres idées" icon="rotate" variant="ghost" small onClick=${() => findWalks(walkLen, true)} loading=${walkBusy} />` : null}
    </${Card}>

    <${Subtitle}>Demander à l'IA</${Subtitle}>
    ${hasKey
      ? html`<${Card}>
          <textarea class="input" value=${question} onInput=${(e) => setQuestion(e.target.value)} placeholder="Ex. Une idée de goûter au chaud près d'ici ?"></textarea>
          <${Button} title="Demander" icon="comments" variant="accent" onClick=${ask} loading=${thinking} />
          ${answer ? html`<div class="mt" style="white-space:pre-wrap">${answer}</div>` : null}
        </${Card}>`
      : html`<div class="muted small">Optionnel : ajoutez une clé Gemini ou Groq (gratuites) dans Plus › Réglages pour poser des questions libres. Les suggestions ci-dessus fonctionnent sans.</div>`}
  </div>`;
}
