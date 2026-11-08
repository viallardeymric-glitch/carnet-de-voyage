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
  const [where, setWhere] = useState('');

  const run = async () => {
    setData(null);
    // Sur place : ma position. Sinon (encore à la maison) : la destination, pas la météo de chez nous.
    const me = await getPosition();
    const ref = trip?.lodging || trip?.city;
    const here = me && ref && distanceMeters(me, ref) < 30000;
    const pos = here ? me : ref;
    setWhere(here ? 'ici, maintenant' : `à ${trip?.city?.name || 'destination'}, maintenant`);
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
              <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.85)">Météo ${where}</div>
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

    <button class="ai-cta" style="margin:10px 0" onClick=${() => go('balades')}><${Icon} name="shoe-prints" /><span><b>Une petite balade à pied ?</b><small>3 boucles faciles autour de vous, guidées sur la carte</small></span><${Icon} name="chevron-right" /></button>

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
