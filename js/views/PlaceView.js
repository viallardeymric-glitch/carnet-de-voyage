// Fiche détaillée d'un lieu : photo, histoire, horaires, avis, « J'adore ! », Y aller.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, navState, back } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { getPosition } from '../core/location.js';
import { categoryById } from '../data/categories.js';
import { fetchWikiSummary } from '../lib/places.js';
import { findPhoto } from '../lib/photos.js';
import { isOpenNow, loadOpeningHours } from '../lib/openNow.js';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { MODES, openDirections, reviewsUrl, tripadvisorUrl } from '../lib/routing.js';
import { savePlace, removePlace } from '../lib/trips.js';
import { tripDays, formatDay } from '../lib/dates.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty } from '../ui/components.js';
import { actionSheet, confirm } from '../ui/dialogs.js';

export default function PlaceView() {
  const { trip, tripId, path, memberId, members } = useApp();
  const { items: saved } = useCollection(path('places'));
  const initial = navState.place;
  const [wiki, setWiki] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState('walk');
  const [ohReady, setOhReady] = useState(false);
  const live = initial && saved.find((s) => (initial.id && s.id === initial.id) || (initial.osmId && s.osmId === initial.osmId));
  const place = live || initial;
  const [note, setNote] = useState(place?.note || '');

  useEffect(() => {
    if (!place) return;
    setPhoto(null);
    fetchWikiSummary(place.tags).then((w) => {
      setWiki(w);
      if (!w?.image) findPhoto(place, { city: trip?.city?.name, width: 800 }).then(setPhoto);
    });
    getPosition().then(setMe);
    if (place.tags?.opening_hours) loadOpeningHours().then(() => setOhReady(true));
  }, [initial]);

  if (!place) return html`<div class="page"><${Empty} text="Lieu introuvable." /></div>`;

  const cat = categoryById(place.category);
  const tags = place.tags || {};
  const isSaved = !!(place.id || live);
  const open = ohReady ? isOpenNow(place, trip?.city?.countryCode) : null;
  const fromMe = distanceMeters(me, place);
  const fromHotel = distanceMeters(trip?.lodging, place);
  const update = (patch) => savePlace(tripId, place, patch, memberId);

  const plan = async () => {
    const v = await actionSheet('Planifier', 'Ajouter ce lieu au :', [
      { label: 'Boîte à idées', value: 'idea' },
      ...tripDays(trip).map((d) => ({ label: `Jour ${d.index} · ${formatDay(d.iso)}`, value: d.index })),
    ]);
    if (v === 'idea') update({ day: null });
    else if (v) update({ day: v, order: Date.now() });
  };

  const info = (icon, text, link) => html`<a class="list-item" href=${link || null} target=${link && !link.startsWith('tel:') ? '_blank' : null} style=${link ? '' : 'color:var(--text)'}>
    <${Icon} name=${icon} style="color:var(--cyan);width:20px;text-align:center" />
    <span class=${`grow ${link ? 'bold' : ''}`}>${text}</span>
    ${link ? html`<${Icon} name="chevron-right" cls="muted small" />` : null}
  </a>`;

  return html`<div class="page">
    ${wiki?.image || photo ? html`<img src=${wiki?.image || photo} class="photo" style="height:210px" alt="" />` : null}
    <h2 class="title">${place.name}</h2>
    <div class="chips wrap mb">
      <${Chip} label=${cat.label} icon=${cat.icon} active color=${cat.color} />
      ${open != null ? html`<${Chip} label=${open ? 'Ouvert' : 'Fermé'} icon="clock" active color=${open ? 'var(--success)' : 'var(--danger)'} />` : null}
      ${place.day ? html`<${Chip} label=${`Jour ${place.day}`} icon="calendar-days" active color="var(--navy)" />` : null}
      ${place.addedBy && members[place.addedBy] ? html`<${Chip} label=${`Ajouté par ${members[place.addedBy].name}`} />` : null}
    </div>

    <div class="row">
      <${Button} cls="grow" variant=${place.favorite ? 'danger' : 'ghost'} icon="heart" title="J'adore !" onClick=${() => update({ favorite: !place.favorite })} />
      <${Button} cls="grow" icon="calendar-plus" title=${isSaved ? 'Planifier' : 'Ajouter'} onClick=${plan} />
    </div>
    ${isSaved
      ? html`<${Button}
          variant=${place.status === 'visited' ? 'accent' : 'ghost'}
          icon=${place.status === 'visited' ? 'circle-check' : 'circle'}
          title=${place.status === 'visited' ? 'Visité ✓' : 'Marquer comme visité'}
          onClick=${() => update({ status: place.status === 'visited' ? 'todo' : 'visited' })}
        />`
      : null}

    <${Subtitle}>Y aller</${Subtitle}>
    <${Card}>
      <div class="chips mb">${MODES.map((m) => html`<${Chip} label=${m.label} icon=${m.icon} active=${mode === m.id} onClick=${() => setMode(m.id)} />`)}</div>
      ${fromMe != null ? html`<div class="muted small">Depuis ma position : ${formatDistance(fromMe)}${mode === 'walk' ? ` · ≈ ${familyWalkMinutes(fromMe)} min au rythme de la petite` : ''}</div>` : null}
      ${fromHotel != null ? html`<div class="muted small">Depuis l'hôtel : ${formatDistance(fromHotel)}</div>` : null}
      <${Button} title="Y aller" icon="diamond-turn-right" variant="accent" onClick=${() => openDirections(place, mode)} style="margin-top:10px" />
      ${mode === 'transit' ? html`<div class="muted xs">Lignes, correspondances et arrêts sont donnés en direct par Plans, Google Maps ou Citymapper.</div>` : null}
    </${Card}>

    ${wiki?.text
      ? html`<${Subtitle}>Histoire</${Subtitle}>
          <${Card}>
            <div>${wiki.text}</div>
            ${wiki.url ? html`<a href=${wiki.url} target="_blank" class="bold" style="display:block;margin-top:8px">Lire sur Wikipédia ›</a>` : null}
          </${Card}>`
      : null}

    <${Subtitle}>Infos pratiques</${Subtitle}>
    <${Card} style="padding:4px 14px">
      ${tags.street ? info('location-dot', tags.street) : null}
      ${tags.opening_hours ? info('clock', tags.opening_hours) : null}
      ${tags.cuisine ? info('utensils', `Cuisine : ${tags.cuisine.replace(/;/g, ', ')}`) : null}
      ${tags.fee === 'no' ? info('tag', 'Entrée gratuite') : null}
      ${tags.wheelchair === 'yes' ? info('baby-carriage', 'Accessible poussette / fauteuil') : null}
      ${tags.website ? info('globe', 'Site officiel', tags.website) : null}
      ${tags.phone ? info('phone', tags.phone, `tel:${tags.phone.replace(/\s/g, '')}`) : null}
      ${info('star', 'Avis Google', reviewsUrl(place))}
      ${info('comments', 'Avis Tripadvisor', tripadvisorUrl(place, trip?.city?.name))}
    </${Card}>

    ${place.category === 'sante'
      ? html`<${SafetyBox}><p>Pour une urgence, appelez directement les secours (Plus › Urgences). Signalez la grossesse dès l'accueil.</p></${SafetyBox}>`
      : null}

    ${isSaved
      ? html`<${Subtitle}>Notre note</${Subtitle}>
          <textarea class="input" placeholder="Réserver avant, idéal pour la pause goûter…" value=${note} onInput=${(e) => setNote(e.target.value)} onBlur=${() => update({ note })}></textarea>
          <${Button}
            title="Retirer de nos lieux"
            variant="ghost"
            icon="trash-can"
            onClick=${async () => {
              if (await confirm('Retirer ce lieu ?', place.name, 'Retirer')) {
                await removePlace(tripId, place.id || live.id);
                back();
              }
            }}
          />`
      : null}
  </div>`;
}
