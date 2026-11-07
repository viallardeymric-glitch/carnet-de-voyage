// Fiche détaillée d'un lieu : photo, histoire, horaires, avis, « J'adore ! », Y aller.
import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp, navState, back, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { getPosition } from '../core/location.js';
import { categoryById } from '../data/categories.js';
import { fetchWikiSummary } from '../lib/places.js';
import { findPhoto, findArticle, articleText } from '../lib/photos.js';
import { VISITABLE, hasGuide, cachedGuide, writeGuide, hasGuideFor, guideTitle } from '../lib/guide.js';
import { getParty } from '../lib/party.js';
import { placeDetails, photoUrl, PRICE } from '../lib/google.js';
import { isOpenNow, loadOpeningHours } from '../lib/openNow.js';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { MODES, openDirections, reviewsUrl, tripadvisorUrl } from '../lib/routing.js';
import { md } from '../ui/md.js';
import TransitPanel from '../ui/TransitPanel.js';
import { savePlace, removePlace } from '../lib/trips.js';
import { tripDays, formatDay } from '../lib/dates.js';
import TimeField from '../ui/TimeField.js';
import { openPhotos } from '../ui/PhotoViewer.js';
import { normTime } from '../lib/dates.js';
import { Card, Button, Chip, Icon, Subtitle, SafetyBox, Empty } from '../ui/components.js';
import { actionSheet, confirm } from '../ui/dialogs.js';

export default function PlaceView() {
  const { trip, tripId, path, memberId, members } = useApp();
  const { items: saved } = useCollection(path('places'));
  const initial = navState.place;
  const [wiki, setWiki] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [g, setG] = useState(null);
  const [gBusy, setGBusy] = useState(false);
  const [openReview, setOpenReview] = useState(-1);
  const [article, setArticle] = useState(null);
  const [fullText, setFullText] = useState(false);
  const [guide, setGuide] = useState(null);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideErr, setGuideErr] = useState('');
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState('walk');
  const [ohReady, setOhReady] = useState(false);
  const live = initial && saved.find((s) => (initial.id && s.id === initial.id) || (initial.osmId && s.osmId === initial.osmId));
  const place = live || initial;
  const [note, setNote] = useState(place?.note || '');

  useEffect(() => {
    if (!place) return;
    setPhoto(null);
    setG(null);
    setArticle(null);
    setFullText(false);
    setGuideErr('');
    setGuide(cachedGuide(place, getParty(trip)));
    const visitable = VISITABLE.includes(place.category) && !place.isLodging;
    const articleJob = visitable
      ? findArticle(place, trip?.city?.name)
          .then((a) => (a ? articleText(a) : null))
          .catch(() => null)
      : Promise.resolve(null);
    articleJob.then(setArticle);
    setGBusy(true);
    placeDetails(place, trip?.city?.name)
      .then(setG)
      .catch((e) => console.warn('google', e.message))
      .finally(() => setGBusy(false));
    fetchWikiSummary(place.tags).then((w) => {
      setWiki(w);
      if (!w?.image) findPhoto(place, { city: trip?.city?.name, width: 800 }).then(setPhoto);
    });
    getPosition().then(setMe);
    if (place.tags?.opening_hours) loadOpeningHours().then(() => setOhReady(true));
  }, [initial]);

  const visitable = place && VISITABLE.includes(place.category) && !place.isLodging;
  const guided = hasGuideFor(place);
  const makeGuide = async (force = false) => {
    if (!hasGuide()) return;
    setGuideBusy(true);
    setGuideErr('');
    try {
      setGuide(
        await writeGuide(place, { city: trip?.city?.name, wiki: article?.text || wiki?.text, summary: g?.editorialSummary?.text, reviews: (g?.reviews || []).map((r) => r.text?.text || r.originalText?.text || '').filter(Boolean).join(' / '), kind: g?.primaryTypeDisplayName?.text, party: getParty(trip), month: trip?.startDate ? new Date(trip.startDate).toLocaleDateString('fr-FR', { month: 'long' }) : '' }, force)
      );
    } catch (e) {
      setGuideErr(e.message || 'Erreur');
    }
    setGuideBusy(false);
  };
  useEffect(() => {
    if (guided && !guide && !guideBusy && !gBusy && hasGuide()) makeGuide();
  }, [guided, gBusy, article]);

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

  const photos = (g?.photos || []).slice(0, 8).map((p) => photoUrl(p.name, 900));
  const bigPhotos = (g?.photos || []).slice(0, 8).map((p) => photoUrl(p.name, 1600));
  const planDay = place.day ? tripDays(trip)[place.day - 1] : null;
  if (!photos.length && (wiki?.image || photo)) photos.push(wiki?.image || photo);
  const rating = g?.rating || place.rating;
  const ratings = g?.userRatingCount || place.ratings;
  const price = PRICE[g?.priceLevel || place.price];
  const openG = g?.currentOpeningHours?.openNow ?? place.openNow;
  const isOpen = openG ?? open;
  const acc = g?.accessibilityOptions || {};
  const perks = [
    g?.goodForChildren && ['child-reaching', 'Adapté aux enfants'],
    g?.menuForChildren && ['ice-cream', 'Menu enfant'],
    g?.restroom && ['restroom', 'Toilettes'],
    (acc.wheelchairAccessibleEntrance || tags.wheelchair === 'yes') && ['baby-carriage', 'Accès poussette'],
    tags.fee === 'no' && ['ticket', 'Entrée gratuite'],
  ].filter(Boolean);
  const todayIdx = (new Date().getDay() + 6) % 7; // Google : lundi = 0
  const hours = g?.regularOpeningHours?.weekdayDescriptions;
  const reviews = g?.reviews || [];

  return html`<div class="page place">
    ${photos.length
      ? html`<div class="gallery-wrap">
          <div class="gallery">${photos.map((u, k) => html`<img src=${u} alt="" loading="lazy" onClick=${() => openPhotos(bigPhotos.length ? bigPhotos : photos, k, place.name)} style="cursor:zoom-in" />`)}</div>
          ${photos.length > 1 ? html`<span class="gallery-count"><${Icon} name="images" /> ${photos.length}</span>` : null}
          ${planDay ? html`<span class="gallery-when"><${Icon} name="calendar-days" /> ${formatDay(planDay.iso)}${normTime(place.time) ? ` · ${normTime(place.time)}` : ''}</span>` : null}
        </div>`
      : html`<div class="gallery gallery-empty" style=${`--c:${cat.color}`}><${Icon} name=${place.isLodging ? 'bed' : cat.icon} /></div>`}

    <div class="place-head">
      <div class="muted xs upper">${place.isLodging ? 'Notre hébergement' : g?.primaryTypeDisplayName?.text || place.kind || cat.label}</div>
      <h2 class="title" style="margin:2px 0 6px">${place.name}</h2>
      ${rating
        ? html`<div class="rate-line big">
            <span class="stars" style=${`--r:${rating}`}></span><b>${rating.toFixed(1)}</b>
            <span class="muted small">${ratings ? `${ratings.toLocaleString('fr-FR')} avis` : ''}</span>
            ${price ? html`<span class="muted small">· ${price}</span>` : null}
          </div>`
        : gBusy
          ? html`<div class="skeleton" style="width:60%"></div>`
          : null}
      <div class="chips wrap" style="margin-top:8px">
        ${isOpen != null ? html`<span class=${`open-tag ${isOpen ? 'on' : ''}`}>${isOpen ? 'Ouvert maintenant' : 'Fermé'}</span>` : null}
        ${place.day ? html`<${Chip} label=${`Jour ${place.day}${tripDays(trip)[place.day - 1] ? ` · ${formatDay(tripDays(trip)[place.day - 1].iso)}` : ''}`} icon="calendar-days" active color="var(--navy)" />` : null}
        ${place.day && place.id ? html`<label class="ptime"><${Icon} name="clock" /><${TimeField} value=${place.time} onSave=${(t) => update({ time: t })} placeholder="Heure ?" /></label>` : null}
        ${place.addedBy && members[place.addedBy] ? html`<${Chip} label=${`Ajouté par ${members[place.addedBy].name}`} />` : null}
      </div>
    </div>

    ${perks.length ? html`<div class="perks">${perks.map(([i, t]) => html`<div class="perk"><${Icon} name=${i} /><span>${t}</span></div>`)}</div>` : null}

    ${g?.editorialSummary?.text ? html`<${Card}><div class="lead">${g.editorialSummary.text}</div></${Card}>` : null}

    ${place.isLodging
      ? null
      : html`<div class="actions3">
          <button class=${`act ${place.favorite ? 'on' : ''}`} onClick=${() => update({ favorite: !place.favorite })}><${Icon} name="heart" /><span>J'adore</span></button>
          <button class="act" onClick=${plan}><${Icon} name="calendar-plus" /><span>${isSaved ? 'Planifier' : 'Ajouter'}</span></button>
          ${isSaved
            ? html`<button class=${`act ${place.status === 'visited' ? 'on ok' : ''}`} onClick=${() => update({ status: place.status === 'visited' ? 'todo' : 'visited' })}>
                <${Icon} name="circle-check" /><span>${place.status === 'visited' ? 'Visité' : 'Visité ?'}</span>
              </button>`
            : html`<button class="act" onClick=${() => openDirections(place, mode)}><${Icon} name="diamond-turn-right" /><span>Y aller</span></button>`}
        </div>`}

    ${guided
      ? html`<div class="row between"><${Subtitle}>${guideTitle(place)}</${Subtitle}>
            ${guide && !guideBusy ? html`<button class="linkbtn" onClick=${() => makeGuide(true)}><${Icon} name="rotate" /> Refaire</button>` : null}</div>
          ${guide
            ? html`<${Card} cls="guide">${md(guide)}</${Card}>`
            : guideBusy || (gBusy && hasGuide())
              ? html`<${Card} cls="guide"><div class="muted small mb"><${Icon} name="wand-magic-sparkles" /> Rédaction du guide…</div><div class="skeleton mb"></div><div class="skeleton mb" style="width:85%"></div><div class="skeleton" style="width:70%"></div></${Card}>`
              : hasGuide()
                ? html`<${Card}><div class="small">${guideErr ? `Guide indisponible (${guideErr}).` : ''}</div><${Button} small title="Écrire le guide" icon="wand-magic-sparkles" onClick=${() => makeGuide(true)} /></${Card}>`
                : html`<${Card} onClick=${() => go('reglages')}><div class="row"><${Icon} name="wand-magic-sparkles" style="color:var(--navy)" /><div class="grow small">Ajoutez une clé Gemini ou Groq (gratuites) dans Réglages pour obtenir un guide détaillé de chaque lieu, adapté à votre famille.</div><${Icon} name="chevron-right" cls="muted" /></div></${Card}>`}`
      : null}

    <${Subtitle}>Y aller</${Subtitle}>
    <${Card}>
      <div class="chips mb">${MODES.map((m) => html`<${Chip} label=${m.label} icon=${m.icon} active=${mode === m.id} onClick=${() => setMode(m.id)} />`)}</div>
      ${fromMe != null ? html`<div class="muted small">Depuis ma position : ${formatDistance(fromMe)}${mode === 'walk' && fromMe < 8000 ? ` · ≈ ${familyWalkMinutes(fromMe)} min au rythme de la famille` : ''}</div>` : null}
      ${fromHotel != null && !place.isLodging ? html`<div class="muted small">Depuis l'hôtel : ${formatDistance(fromHotel)}</div>` : null}
      ${mode === 'transit'
        ? html`<div class="mt"><${TransitPanel}
            origins=${[
              ...(me && (fromMe < 30000 || place.isLodging || !trip?.lodging) ? [{ label: 'ma position', icon: 'location-crosshairs', point: me }] : []),
              ...(trip?.lodging && !place.isLodging ? [{ label: "l'hôtel", icon: 'bed', point: trip.lodging }] : []),
              ...(me && fromMe >= 30000 && trip?.lodging && !place.isLodging ? [{ label: 'ma position', icon: 'location-crosshairs', point: me }] : []),
            ]}
            to=${place}
            city=${trip?.city?.name} /></div>`
        : html`<${Button} title="Y aller" icon="diamond-turn-right" variant="accent" onClick=${() => openDirections(place, mode)} style="margin-top:10px" />`}
    </${Card}>

    ${reviews.length
      ? html`<div class="row between"><${Subtitle}>Avis</${Subtitle}>${g?.googleMapsUri ? html`<a class="small bold" href=${g.googleMapsUri} target="_blank">Tous les avis ›</a>` : null}</div>
          <div class="reviews">
            ${reviews.map(
              (r, i) => html`<div class="review" onClick=${() => setOpenReview(openReview === i ? -1 : i)}>
                <div class="row" style="gap:8px">
                  ${r.authorAttribution?.photoUri ? html`<img class="avatar" src=${r.authorAttribution.photoUri} alt="" referrerpolicy="no-referrer" />` : html`<span class="avatar"><${Icon} name="user" /></span>`}
                  <div class="grow" style="min-width:0">
                    <div class="bold small ellipsis">${r.authorAttribution?.displayName || 'Voyageur'}</div>
                    <div class="row" style="gap:6px"><span class="stars sm" style=${`--r:${r.rating || 0}`}></span><span class="muted xs">${r.relativePublishTimeDescription || ''}</span></div>
                  </div>
                </div>
                <div class=${`review-text ${openReview === i ? 'open' : ''}`}>${r.text?.text || r.originalText?.text || ''}</div>
              </div>`
            )}
          </div>`
      : null}

    ${hours
      ? html`<${Subtitle}>Horaires</${Subtitle}>
          <${Card} style="padding:6px 13px">
            ${hours.map((h, i) => {
              const [d, ...rest] = h.split(': ');
              return html`<div class=${`hour ${i === todayIdx ? 'today' : ''}`}><span>${d}</span><span>${rest.join(': ')}</span></div>`;
            })}
          </${Card}>`
      : null}

    ${article?.text || wiki?.text
      ? html`<${Subtitle}>Histoire</${Subtitle}>
          <${Card}>
            <div class=${`history ${fullText ? 'open' : ''}`}>${(article?.text || wiki.text).split('\n').map((p) => html`<p>${p}</p>`)}</div>
            ${article?.text && article.text.length > 600 ? html`<button class="linkbtn" onClick=${() => setFullText(!fullText)}>${fullText ? 'Réduire' : 'Lire la suite'}</button>` : null}
            ${(article?.url || wiki?.url) ? html`<a href=${article?.url || wiki.url} target="_blank" class="bold small" style="display:block;margin-top:8px">Article complet sur Wikipédia ›</a>` : null}
          </${Card}>`
      : null}

    <${Subtitle}>Infos pratiques</${Subtitle}>
    <${Card} style="padding:4px 14px">
      ${g?.formattedAddress || tags.street || place.address ? info('location-dot', g?.formattedAddress || tags.street || place.address) : null}
      ${!hours && tags.opening_hours ? info('clock', tags.opening_hours) : null}
      ${g?.nationalPhoneNumber ? info('phone', g.nationalPhoneNumber, `tel:${(g.internationalPhoneNumber || g.nationalPhoneNumber).replace(/\s/g, '')}`) : null}
      ${g?.websiteUri && !tags.website ? info('globe', 'Site officiel', g.websiteUri) : null}
      ${tags.cuisine ? info('utensils', `Cuisine : ${tags.cuisine.replace(/;/g, ', ')}`) : null}
      ${tags.website ? info('globe', 'Site officiel', tags.website) : null}
      ${tags.phone ? info('phone', tags.phone, `tel:${tags.phone.replace(/\s/g, '')}`) : null}
      ${info('star', 'Voir sur Google Maps', g?.googleMapsUri || reviewsUrl(place))}
      ${info('comments', 'Avis Tripadvisor', tripadvisorUrl(place, trip?.city?.name))}
    </${Card}>

    ${place.category === 'sante'
      ? html`<${SafetyBox}><p>Pour une urgence, appelez directement les secours (Plus › Urgences). ${getParty(trip).some((t) => t.pregnant) ? " Signalez la grossesse dès l'accueil." : ''}</p></${SafetyBox}>`
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
