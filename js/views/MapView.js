// Carte 3D interactive (MapLibre + OpenFreeMap, gratuit et sans clé) : bâtiments en relief,
// inclinaison et rotation au doigt, parcours de chaque jour en couleur, lieux numérotés,
// fiche d'aperçu avec photo, positions E (bleu) et M (rose) en direct.
/* global maplibregl */
import { html, useEffect, useMemo, useRef, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { useLiveLocation } from '../core/location.js';
import { otherMember } from '../core/config.js';
import { CATEGORIES, categoryById } from '../data/categories.js';
import { fetchPlaces } from '../lib/places.js';
import { isOpenNow, loadOpeningHours } from '../lib/openNow.js';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { tripDays, formatDay, dayColor } from '../lib/dates.js';
import { openDirections } from '../lib/routing.js';
import { savePlace } from '../lib/trips.js';
import { Chip, Icon, MemberBadge, Thumb } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const VIEW_3D = { pitch: 60, bearing: -20 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  return m <= 0 ? "à l'instant" : `il y a ${m} min`;
};

// La bibliothèque de carte (1 Mo) n'est chargée qu'à la première ouverture de la carte.
let loader = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'vendor/maplibre/maplibre-gl.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'vendor/maplibre/maplibre-gl.js';
      s.onload = resolve;
      s.onerror = () => ((loader = null), reject(new Error('maplibre')));
      document.head.appendChild(s);
    });
  }
  return loader;
}

// Bâtiments en relief (si le style n'en a pas déjà) + ciel et brume à l'horizon.
function decorate(m) {
  const style = m.getStyle();
  const has3d = style.layers.some((l) => l.type === 'fill-extrusion');
  if (!has3d && style.sources.openmaptiles) {
    const before = style.layers.find((l) => l.type === 'symbol')?.id;
    m.addLayer(
      {
        id: 'cdv-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#E9DFD3',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      },
      before
    );
  }
  try {
    m.setSky({
      'sky-color': '#8EC9F5',
      'horizon-color': '#FFE4CF',
      'fog-color': '#FFF4EA',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.35,
    });
  } catch {
    // ancienne version : pas de ciel, sans gravité
  }
  m.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  m.addLayer({ id: 'routes-casing', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 8, 'line-opacity': 0.9 } });
  m.addLayer({ id: 'routes', type: 'line', source: 'routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 4.5 } });
}

function el(cls, inner, style = '') {
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = inner;
  if (style) d.setAttribute('style', style);
  return d;
}

export default function MapView() {
  const { trip, tripId, path, memberId, member, members } = useApp();
  const { items: saved } = useCollection(path('places'));
  const { me, others, error } = useLiveLocation();
  const box = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [category, setCategory] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ohReady, setOhReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState(0); // 0 = tout le séjour
  const [sel, setSel] = useState(null);
  const [is3d, setIs3d] = useState(true);
  const [bearing, setBearing] = useState(0);

  const base = trip?.lodging || trip?.city;
  const days = tripDays(trip);

  // Création de la carte, avec une arrivée « survol » vers l'hôtel.
  useEffect(() => {
    if (!base || map.current) return;
    let m;
    let alive = true;
    loadMapLibre()
      .then(() => {
        if (!alive || !box.current) return;
        const intro = !sessionStorage.getItem('cdv-intro');
        m = new maplibregl.Map({
          container: box.current,
          style: STYLE,
          center: [base.lon, base.lat],
          zoom: intro ? 11.5 : 15.6,
          pitch: intro ? 0 : VIEW_3D.pitch,
          bearing: intro ? 0 : VIEW_3D.bearing,
          maxPitch: 78,
          attributionControl: { compact: true },
        });
        map.current = m;
        m.on('load', () => {
          decorate(m);
          setReady(true);
          if (intro) {
            sessionStorage.setItem('cdv-intro', '1');
            m.flyTo({ center: [base.lon, base.lat], zoom: 15.6, ...VIEW_3D, duration: 3800, curve: 1.3, essential: true });
          }
        });
        m.on('rotate', () => setBearing(m.getBearing()));
        m.on('pitchend', () => setIs3d(m.getPitch() > 20));
        m.on('click', () => setSel(null));
        m.on('error', (e) => console.warn('carte', e?.error?.message || e));
      })
      .catch(() => setFailed(true));
    return () => {
      alive = false;
      markers.current.forEach((k) => k.remove());
      markers.current = [];
      m?.remove();
      map.current = null;
    };
  }, [!!base]);

  useEffect(() => {
    if (openOnly && !ohReady) loadOpeningHours().then(() => setOhReady(true));
  }, [openOnly]);

  const search = async (catId) => {
    if (!map.current || !catId) return;
    const c = map.current.getCenter();
    setLoading(true);
    try {
      setResults(await fetchPlaces(catId, { lat: c.lat, lon: c.lng }, catId === 'sante' ? 3000 : 1500));
    } catch {
      toast('Recherche impossible (réseau). Réessayez.');
    }
    setLoading(false);
  };

  const pickCategory = (id) => {
    const next = category === id ? null : id;
    setCategory(next);
    setResults([]);
    if (next) search(next);
  };

  const cc = trip?.city?.countryCode;
  const plan = useMemo(() => {
    const byDay = {};
    for (const p of saved) if (p.day && p.lat != null) (byDay[p.day] ||= []).push(p);
    for (const d in byDay) byDay[d].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return byDay;
  }, [saved]);
  const visibleSaved = useMemo(
    () =>
      saved
        .filter((s) => s.lat != null && (!day || s.day === day))
        .filter((s) => !openOnly || isOpenNow(s, cc) !== false),
    [saved, day, openOnly, ohReady]
  );
  const visibleResults = useMemo(() => {
    const ids = new Set(saved.map((s) => s.osmId).filter(Boolean));
    return results.filter((r) => !ids.has(r.osmId)).filter((r) => !openOnly || isOpenNow(r, cc) === true);
  }, [results, saved, openOnly, ohReady]);

  // Parcours de chaque jour : hôtel → lieux dans l'ordre → retour.
  useEffect(() => {
    const src = ready && map.current?.getSource('routes');
    if (!src) return;
    const start = trip?.lodging ? [[trip.lodging.lon, trip.lodging.lat]] : [];
    const features = Object.entries(plan)
      .filter(([d]) => !day || Number(d) === day)
      .map(([d, list]) => ({
        type: 'Feature',
        properties: { color: dayColor(Number(d)) },
        geometry: { type: 'LineString', coordinates: [...start, ...list.map((p) => [p.lon, p.lat]), ...start] },
      }))
      .filter((f) => f.geometry.coordinates.length > 1);
    src.setData({ type: 'FeatureCollection', features });
  }, [plan, day, ready, trip?.lodging]);

  // Marqueurs (recréés à chaque changement : quelques dizaines au plus).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    markers.current.forEach((k) => k.remove());
    markers.current = [];
    const add = (node, lon, lat, onTap) => {
      if (onTap)
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          onTap();
        });
      markers.current.push(new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat([lon, lat]).addTo(m));
    };

    visibleResults.forEach((p) => {
      const c = categoryById(p.category);
      add(el('mk mk-dot', `<i class="fa-solid fa-${c.icon}"></i>`, `--c:${c.color}`), p.lon, p.lat, () => setSel(p));
    });
    visibleSaved.forEach((p) => {
      if (p.day) {
        const n = (plan[p.day] || []).indexOf(p) + 1;
        add(el(`mk mk-num ${p.status === 'visited' ? 'done' : ''}`, `<span>${n || '•'}</span>`, `--c:${dayColor(p.day)}`), p.lon, p.lat, () => setSel(p));
      } else {
        const c = categoryById(p.category);
        add(el('mk mk-pin', `<i class="fa-solid fa-${p.favorite ? 'heart' : c.icon}"></i>`, `--c:${p.favorite ? 'var(--pink)' : c.color}`), p.lon, p.lat, () => setSel(p));
      }
    });
    if (trip?.lodging) {
      const h = trip.lodging;
      add(el('mk mk-home', `<i class="fa-solid fa-bed"></i><b>Hôtel</b>`), h.lon, h.lat, () => setSel({ ...h, name: h.name, category: 'monuments', isLodging: true }));
    }
    const people = [...(me && member ? [{ ...me, id: member.id, self: true }] : []), ...others];
    people.forEach((o) => {
      const mm = members[o.id];
      if (!mm) return;
      const node = el('mk-person', `<span class="badge" style="width:36px;height:36px;background:${mm.color};font-size:15px">${esc(mm.id)}</span>`);
      node.title = o.self ? `${mm.name} (moi)` : `${mm.name} · ${ago(o.updatedAtMs)}`;
      add(node, o.lon, o.lat, () => toast(node.title));
    });
  }, [ready, visibleSaved, visibleResults, plan, me, others, trip?.lodging]);

  // Choix d'un jour : on cadre son parcours.
  const pickDay = (d) => {
    const next = day === d ? 0 : d;
    setDay(next);
    setSel(null);
    const list = next ? plan[next] || [] : saved.filter((p) => p.lat != null);
    const pts = [...list, ...(trip?.lodging ? [trip.lodging] : [])];
    if (!map.current || pts.length === 0) return;
    if (pts.length === 1) return map.current.flyTo({ center: [pts[0].lon, pts[0].lat], zoom: 16, ...VIEW_3D });
    const lons = pts.map((p) => p.lon);
    const lats = pts.map((p) => p.lat);
    map.current.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: { top: 120, bottom: 200, left: 50, right: 70 }, pitch: is3d ? 50 : 0, bearing: is3d ? VIEW_3D.bearing : 0, duration: 1600, maxZoom: 16.5 }
    );
  };

  const focus = (p, zoom = 16.5) => p && map.current?.flyTo({ center: [p.lon, p.lat], zoom, duration: 1400, ...(is3d ? VIEW_3D : { pitch: 0 }) });
  const toggle3d = () => {
    const next = !is3d;
    setIs3d(next);
    map.current?.easeTo({ pitch: next ? VIEW_3D.pitch : 0, bearing: next ? VIEW_3D.bearing : 0, duration: 900 });
  };
  const select = (p) => {
    setSel(p);
    focus(p, Math.max(map.current?.getZoom() || 16, 16));
  };

  const partner = others.find((o) => o.id === otherMember(memberId));
  const gap = me && partner ? distanceMeters(me, partner) : null;
  const selFromHotel = sel && !sel.isLodging ? distanceMeters(trip?.lodging, sel) : null;
  const selSaved = sel && (sel.id || saved.some((s) => s.osmId && s.osmId === sel.osmId));

  return html`<div class="mapwrap">
    <div id="map" ref=${box}></div>
    ${failed ? html`<div class="map-fail"><${Icon} name="map" /><div>Carte indisponible. Vérifiez la connexion puis rouvrez l'onglet.</div></div>` : null}

    <div class="map-top">
      <div class="chips">
        <${Chip} label="Ouvert maintenant" icon="clock" active=${openOnly} onClick=${() => setOpenOnly(!openOnly)} color="var(--success)" />
        ${CATEGORIES.map((c) => html`<${Chip} label=${c.label} icon=${c.icon} active=${category === c.id} color=${c.color} onClick=${() => pickCategory(c.id)} />`)}
      </div>
      ${partner && gap != null
        ? html`<div class="banner">
            <${MemberBadge} member=${members[partner.id]} size=${24} />
            <div class="grow">
              ${gap < 60
                ? html`<b>Vous êtes ensemble</b>`
                : html`<b>${members[partner.id].name} est à ${formatDistance(gap)}</b> · ≈ ${familyWalkMinutes(gap)} min à pied`}
              <span class="muted"> ${ago(partner.updatedAtMs)}</span>
            </div>
          </div>`
        : null}
      ${error === 'denied'
        ? html`<div class="banner"><${Icon} name="triangle-exclamation" style="color:var(--warning)" />
            <div class="grow small">Position refusée : Réglages iPhone › Confidentialité › Service de localisation › Sites Safari › « Lorsque l'app est active ».</div></div>`
        : null}
    </div>

    <div class=${`fabs ${sel ? 'hide' : ''}`}>
      ${loading ? html`<div class="spinner" style="margin:0"></div>` : null}
      ${category && !loading ? html`<button class="fab wide" onClick=${() => search(category)}><${Icon} name="rotate" />Chercher ici</button>` : null}
      <button class="fab fab-text" onClick=${toggle3d} aria-label="Vue 2D ou 3D">${is3d ? '2D' : '3D'}</button>
      ${Math.abs(bearing) > 2
        ? html`<button class="fab" onClick=${() => map.current?.easeTo({ bearing: 0, duration: 700 })} aria-label="Nord"><span class="compass" style=${`transform:rotate(${-bearing}deg)`}><${Icon} name="location-arrow" /></span></button>`
        : null}
      ${me ? html`<button class="fab" onClick=${() => focus(me)} aria-label="Ma position"><${Icon} name="location-crosshairs" /></button>` : null}
      ${partner ? html`<button class="fab" style=${`color:${members[partner.id].color}`} onClick=${() => focus(partner)} aria-label="Conjoint"><${Icon} name="heart" /></button>` : null}
      ${trip?.lodging ? html`<button class="fab" onClick=${() => focus(trip.lodging)} aria-label="Hôtel"><${Icon} name="bed" /></button>` : null}
      <button class="fab" onClick=${() => go('assistant')} aria-label="Assistant"><${Icon} name="wand-magic-sparkles" /></button>
    </div>

    <div class="map-bottom">
      ${sel
        ? html`<div class="peek" key=${sel.id || sel.osmId || sel.name}>
            <${Thumb} place=${sel} city=${trip?.city?.name} size=${78} />
            <div class="grow" style="min-width:0">
              <div class="peek-title">${sel.name}</div>
              <div class="muted xs">
                ${sel.isLodging ? 'Notre hébergement' : categoryById(sel.category).label}
                ${sel.day ? html` · <b style=${`color:${dayColor(sel.day)}`}>Jour ${sel.day}</b>` : null}
                ${selFromHotel != null ? ` · ${formatDistance(selFromHotel)} de l'hôtel` : ''}
              </div>
              <div class="row" style="margin-top:8px;gap:6px">
                ${!sel.isLodging ? html`<button class="pill" onClick=${() => go('lieu', { place: sel })}><${Icon} name="circle-info" /> Fiche</button>` : null}
                <button class="pill accent" onClick=${() => openDirections(sel, 'walk')}><${Icon} name="diamond-turn-right" /> Y aller</button>
                ${!sel.isLodging && !selSaved
                  ? html`<button class="pill" onClick=${() => (savePlace(tripId, sel, {}, memberId), toast('Ajouté à la boîte à idées'))}><${Icon} name="plus" /> Garder</button>`
                  : null}
              </div>
            </div>
            <button class="iconbtn" onClick=${() => setSel(null)} aria-label="Fermer"><${Icon} name="xmark" /></button>
          </div>`
        : null}
      ${days.length
        ? html`<div class="daybar">
            <button class=${`day ${day === 0 ? 'on' : ''}`} style="--c:var(--navy)" onClick=${() => pickDay(0)}>Tout</button>
            ${days.map(
              (d) => html`<button class=${`day ${day === d.index ? 'on' : ''}`} style=${`--c:${dayColor(d.index)}`} onClick=${() => pickDay(d.index)}>
                <i></i>Jour ${d.index}<small>${formatDay(d.iso).split(' ').slice(0, 2).join(' ')}</small>
              </button>`
            )}
          </div>`
        : null}
    </div>
  </div>`;
}
