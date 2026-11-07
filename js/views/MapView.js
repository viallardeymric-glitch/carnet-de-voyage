// Carte 3D interactive (MapLibre + OpenFreeMap, gratuit et sans clé) : bâtiments en relief,
// inclinaison et rotation au doigt, parcours de chaque jour en couleur, lieux numérotés,
// fiche d'aperçu avec photo, positions E (bleu) et M (rose) en direct.
/* global maplibregl */
import { html, useEffect, useMemo, useRef, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { useLiveLocation } from '../core/location.js';
import { otherMember, ls } from '../core/config.js';
import { CATEGORIES, categoryById, subById } from '../data/categories.js';
import { fetchPlaces } from '../lib/places.js';
import { nearbyGoogle, hasGoogle, searchPlaces, hotelsNear, PRICE } from '../lib/google.js';
import { store } from '../core/store.js';
import { searchAddress } from '../lib/places.js';
import { cachedPhoto, findPhoto } from '../lib/photos.js';
import TransitPanel, { LineBadge } from '../ui/TransitPanel.js';
import { isOpenNow, loadOpeningHours } from '../lib/openNow.js';
import { distanceMeters, formatDistance, familyWalkMinutes, bestCenter, circle } from '../lib/geo.js';
import { tripDays, formatDay, dayColor } from '../lib/dates.js';
import { openDirections } from '../lib/routing.js';
import { savePlace, verifyLodging } from '../lib/trips.js';
import { Chip, Icon, MemberBadge, Thumb } from '../ui/components.js';
import { toast, confirm } from '../ui/dialogs.js';

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const VIEW_3D = { pitch: 52, bearing: -20 };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m <= 0) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
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
      'sky-color': '#5DB4F0',
      'horizon-color': '#CFEAFB',
      'fog-color': '#CFEAFB',
      'sky-horizon-blend': 0.5,
      'horizon-fog-blend': 0.15,
      'fog-ground-blend': 0.95,
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
  const [subId, setSubId] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ohReady, setOhReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState(() => Number(sessionStorage.getItem('cdv-mapday') || 0)); // 0 = tout le séjour, -1 = planning masqué
  const [sel, setSel] = useState(null);
  const [finding, setFinding] = useState(false); // barre de recherche ouverte
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null);
  const [findBusy, setFindBusy] = useState(false);
  const [pin, setPin] = useState(null);
  // Guidage : trajet en transports tracé sur la carte, ma position suivie.
  const [guide, setGuide] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('cdv-guide') || 'null');
    } catch {
      return null;
    }
  });
  const [follow, setFollow] = useState(false);
  const [routeFor, setRouteFor] = useState(null); // lieu pour lequel on choisit un itinéraire
  // Mode « hôtel idéal » : zone la plus proche des lieux choisis + hôtels classés par distance moyenne.
  const [hotelMode, setHotelMode] = useState(() => sessionStorage.getItem('cdv-hotelmode') === '1');
  const [hotels, setHotels] = useState(null);
  const [hotelSel, setHotelSel] = useState(null);
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

  // Recherche : Google (rapide, les plus populaires, avec notes) et OpenStreetMap en parallèle.
  const searchId = useRef(0);
  const search = async (catId, sId = subId) => {
    if (!map.current || !catId) return;
    const sub = sId ? subById(catId, sId) : null;
    const c = map.current.getCenter();
    const center = { lat: c.lat, lon: c.lng };
    const radius = catId === 'sante' ? 3000 : sub ? 1500 : 1800;
    const id = ++searchId.current;
    setLoading(true);
    let google = [];
    const merge = (osm) => {
      const near = (a, b) => Math.abs(a.lat - b.lat) < 0.0004 && Math.abs(a.lon - b.lon) < 0.0006;
      return [...google, ...osm.filter((o) => !google.some((g) => near(g, o) && (g.name.toLowerCase().includes(o.name.toLowerCase().slice(0, 5)) || near(g, o))))];
    };
    const jobs = [];
    if (hasGoogle())
      jobs.push(
        nearbyGoogle(catId, center, radius, sub)
          .then((list) => {
            google = list.map((x) => ({ ...x, sub: sId || null }));
            if (id === searchId.current) setResults((prev) => merge(prev.filter((r) => !r.googleId)));
          })
          .catch((e) => console.warn('google', e.message))
      );
    jobs.push(
      fetchPlaces(catId, center, radius, 150, sub)
        .then((osm) => id === searchId.current && setResults(merge(osm.map((x) => ({ ...x, sub: sId || null })))))
        .catch(() => {})
    );
    await Promise.all(jobs);
    if (id !== searchId.current) return;
    setLoading(false);
    setResults((r) => {
      if (!r.length) toast('Rien trouvé ici (ou pas de réseau). Déplacez la carte puis « Chercher ici ».');
      return r;
    });
  };

  const pickCategory = (id) => {
    const next = category === id ? null : id;
    setCategory(next);
    setSubId(null);
    setResults([]);
    if (next) search(next, null);
  };
  const pickSub = (id) => {
    const next = subId === id ? null : id;
    setSubId(next);
    setResults([]);
    search(category, next);
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
        .filter((s) => s.lat != null && day !== -1 && (!day || s.day === day))
        .filter((s) => !openOnly || isOpenNow(s, cc) !== false),
    [saved, day, openOnly, ohReady]
  );
  const visibleResults = useMemo(() => {
    const ids = new Set(saved.map((s) => s.osmId).filter(Boolean));
    const gids = new Set(saved.map((s) => s.googleId).filter(Boolean));
    return results
      .filter((r) => !(r.osmId && ids.has(r.osmId)) && !(r.googleId && gids.has(r.googleId)))
      .filter((r) => !openOnly || r.openNow === true || (r.openNow == null && isOpenNow(r, cc) === true));
  }, [results, saved, openOnly, ohReady]);

  // Parcours de chaque jour : hôtel → lieux dans l'ordre → retour.
  useEffect(() => {
    const src = ready && map.current?.getSource('routes');
    if (!src) return;
    const start = trip?.lodging ? [[trip.lodging.lon, trip.lodging.lat]] : [];
    const features = Object.entries(plan)
      .filter(([d]) => day !== -1 && (!day || Number(d) === day))
      .map(([d, list]) => ({
        type: 'Feature',
        properties: { color: dayColor(Number(d)) },
        geometry: { type: 'LineString', coordinates: [...start, ...list.map((p) => [p.lon, p.lat]), ...start] },
      }))
      .filter((f) => f.geometry.coordinates.length > 1);
    src.setData({ type: 'FeatureCollection', features });
  }, [plan, day, ready, trip?.lodging]);

  // Marqueurs, par groupe : un groupe n'est redessiné que si ses propres données changent
  // (la position GPS qui bouge ne redessine plus tous les lieux).
  const groups = useRef({});
  const draw = (name, items) => {
    const m = map.current;
    (groups.current[name] || []).forEach((k) => k.remove());
    groups.current[name] = [];
    if (!m) return;
    for (const [node, lon, lat, onTap] of items) {
      if (onTap)
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          onTap();
        });
      groups.current[name].push(new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat([lon, lat]).addTo(m));
    }
  };
  useEffect(() => () => Object.values(groups.current).flat().forEach((k) => k.remove()), []);

  useEffect(() => {
    if (!ready) return;
    draw(
      'results',
      visibleResults.map((p) => {
        let c = categoryById(p.category);
        const sb = p.sub && subById(p.category, p.sub);
        if (sb) c = { ...c, icon: sb.icon };
        const node = p.rating
          ? el('mk mk-rate', `<i class="fa-solid fa-${c.icon}"></i><b>${p.rating.toFixed(1)}</b>`, `--c:${c.color}`)
          : el('mk mk-dot', `<i class="fa-solid fa-${c.icon}"></i>`, `--c:${c.color}`);
        return [node, p.lon, p.lat, () => setSel(p)];
      })
    );
  }, [ready, visibleResults]);

  useEffect(() => {
    if (!ready) return;
    draw(
      'saved',
      visibleSaved.map((p) => {
        // Bulle photo flottante : la photo du lieu, cerclée de la couleur du jour, avec son numéro.
        const c = categoryById(p.category);
        const color = p.day ? dayColor(p.day) : p.favorite ? 'var(--pink)' : c.color;
        const n = p.day ? (plan[p.day] || []).indexOf(p) + 1 : 0;
        const badge = p.day ? `<em>${n || '•'}</em>` : p.favorite ? '<em><i class="fa-solid fa-heart"></i></em>' : '';
        const node = el(`mk-photo ${p.status === 'visited' ? 'done' : ''}`, `<span class="ph"><i class="fa-solid fa-${c.icon}"></i></span>${badge}`, `--c:${color}`);
        const ph = node.querySelector('.ph');
        const set = (url) => url && ((ph.style.backgroundImage = `url("${url}")`), ph.classList.add('has'));
        const quick = cachedPhoto(p, 120);
        if (quick) set(quick);
        else findPhoto(p, { city: trip?.city?.name, width: 120 }).then(set).catch(() => {});
        return [node, p.lon, p.lat, () => setSel(p)];
      })
    );
  }, [ready, visibleSaved, plan]);

  useEffect(() => {
    verifyLodging(trip, tripId).then((fixed) => {
      if (!fixed) return;
      toast(`Hébergement replacé au bon endroit : ${fixed.address || trip.city?.name}`);
      map.current?.flyTo({ center: [fixed.lon, fixed.lat], zoom: 15, duration: 1600 });
    });
  }, [tripId, !!trip?.city, trip?.lodging?.verified]);
  const lodgingPlace = trip?.lodging ? { ...trip.lodging, category: 'monuments', isLodging: true } : null;
  useEffect(() => {
    if (!ready) return;
    const h = lodgingPlace;
    draw('lodging', h ? [[el('mk mk-home', `<i class="fa-solid fa-bed"></i><b>Hôtel</b>`), h.lon, h.lat, () => setSel(h)]] : []);
  }, [ready, trip?.lodging?.lat, trip?.lodging?.name]);

  useEffect(() => {
    if (!ready) return;
    const people = [...(me && member ? [{ ...me, id: member.id, self: true }] : []), ...others];
    const items = [];
    people.forEach((o) => {
      const mm = members[o.id];
      if (!mm) return;
      const node = el('mk-person', `<span class="badge" style="width:36px;height:36px;background:${mm.color};font-size:15px">${esc(mm.id)}</span>`);
      const label = `${mm.name} (moi)`;
      items.push([node, o.lon, o.lat, o.self ? () => toast(label) : () => joinPartner(o)]);
    });
    draw('people', items);
  }, [ready, me?.lat, me?.lon, others]);

  // Choix d'un jour : on cadre son parcours.
  const pickDay = (d) => {
    const next = day === d ? 0 : d;
    setDay(next);
    sessionStorage.setItem('cdv-mapday', String(next));
    if (next === -1) return setSel(null);
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

  // Recherche libre : Google (lieux, monuments, commerces), sinon OpenStreetMap.
  const qTimer = useRef(null);
  const runFind = async (text) => {
    const t = text.trim();
    if (t.length < 2) return setFound(null);
    setFindBusy(true);
    const near = map.current ? (({ lng, lat }) => ({ lat, lon: lng }))(map.current.getCenter()) : base;
    let list = [];
    try {
      if (hasGoogle()) list = await searchPlaces(t, near);
    } catch {
      list = [];
    }
    if (!list.length) {
      try {
        list = (await searchAddress(t, trip?.city || near)).map((r) => ({ ...r, category: 'monuments', kind: '' }));
      } catch {
        list = [];
      }
    }
    setFound(list.map((p) => ({ ...p, d: me ? distanceMeters(me, p) : distanceMeters(base, p) })));
    setFindBusy(false);
  };
  const onFindInput = (v) => {
    setQ(v);
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => runFind(v), 450);
  };
  const pickFound = (p) => {
    setFinding(false);
    setFound(null);
    setPin(p);
    select(p);
  };
  useEffect(() => {
    if (!ready) return;
    const c = pin && categoryById(pin.category);
    draw('search', pin ? [[el('mk mk-pin mk-found', `<i class="fa-solid fa-${c?.icon || 'location-dot'}"></i>`, `--c:var(--danger)`), pin.lon, pin.lat, () => setSel(pin)]] : []);
  }, [ready, pin]);

  const targets = saved.filter((p) => p.lat != null);
  const zone = useMemo(() => {
    const c = bestCenter(targets);
    if (!c) return null;
    const ds = targets.map((p) => distanceMeters(c, p)).sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)] || 800;
    return { center: c, r: Math.min(Math.max(med * 0.6, 400), 1500) };
  }, [targets.map((p) => `${p.lat},${p.lon}`).join('|')]);
  const scoreHotel = (h) => {
    const ds = targets.map((p) => distanceMeters(h, p));
    const avg = ds.reduce((a, b) => a + b, 0) / Math.max(ds.length, 1);
    return { ...h, avg, avgWalk: familyWalkMinutes(avg), near: ds.filter((d) => d < 1200).length };
  };
  const loadHotels = async (where) => {
    if (!hasGoogle()) return toast('La recherche d’hôtels demande la clé Google (Réglages)');
    setHotels(null);
    try {
      const c = where || zone?.center || base;
      const list = await hotelsNear(c, Math.max((zone?.r || 800) * 2, 1500));
      setHotels(list.map(scoreHotel).sort((a, b) => a.avg - b.avg - ((b.rating || 0) - (a.rating || 0)) * 150));
    } catch (e) {
      toast(e.message);
      setHotels([]);
    }
  };
  const enterHotelMode = () => {
    if (!targets.length) return toast('Ajoutez d’abord les lieux que vous voulez voir (bouton « Garder » ou Rechercher)');
    sessionStorage.setItem('cdv-hotelmode', '1');
    setSel(null);
    setGuide(null);
    setHotelMode(true);
  };
  const exitHotelMode = () => {
    sessionStorage.removeItem('cdv-hotelmode');
    setHotelMode(false);
    setHotels(null);
    setHotelSel(null);
  };
  const chooseHotel = async (h) => {
    if (trip?.lodging && trip.lodging.name !== h.name && !(await confirm('Changer d’hébergement ?', `${trip.lodging.name} sera remplacé par ${h.name} pour ce voyage.`, 'Remplacer'))) return;
    await store.update(`trips/${tripId}`, { lodging: { name: h.name, address: h.address || h.tags?.street || '', lat: h.lat, lon: h.lon, googleId: h.googleId || null, verified: true } });
    toast(`${h.name} est maintenant l'hébergement du voyage`);
    exitHotelMode();
  };
  const bookingUrl = (h) =>
    `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(`${h.name} ${trip?.city?.name || ''}`)}${trip?.startDate ? `&checkin=${trip.startDate}&checkout=${trip.endDate}` : ''}&group_adults=${Math.max(1, (trip?.party || []).filter((t) => t.kind === 'adulte').length || 2)}&group_children=${(trip?.party || []).filter((t) => t.kind === 'enfant' || t.kind === 'bebe').length}`;
  useEffect(() => {
    if (hotelMode && ready && zone && hotels === null) loadHotels();
  }, [hotelMode, ready, !!zone]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (!m.getSource('zone')) {
      m.addSource('zone', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': '#16A9B4', 'fill-opacity': 0.14 } });
      m.addLayer({ id: 'zone-line', type: 'line', source: 'zone', paint: { 'line-color': '#0E9AA7', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
    }
    m.getSource('zone').setData({ type: 'FeatureCollection', features: hotelMode && zone ? [circle(zone.center, zone.r)] : [] });
    if (hotelMode && zone) {
      const pts = [...targets, zone.center];
      const b = pts.reduce((bb, p) => bb.extend([p.lon, p.lat]), new maplibregl.LngLatBounds([pts[0].lon, pts[0].lat], [pts[0].lon, pts[0].lat]));
      m.fitBounds(b, { padding: { top: 150, bottom: 300, left: 40, right: 70 }, pitch: 0, bearing: 0, duration: 1200, maxZoom: 15.5 });
    }
  }, [ready, hotelMode, zone]);
  useEffect(() => {
    if (!ready) return;
    draw(
      'hotels',
      hotelMode && hotels
        ? hotels.map((h, i) => [
            el(`mk mk-rate mk-hotel ${hotelSel?.googleId === h.googleId ? 'on' : ''}`, `<i class="fa-solid fa-bed"></i><b>${i < 3 ? `#${i + 1} · ` : ''}${h.avgWalk}′</b>`, `--c:${i < 3 ? 'var(--navy)' : '#6B7280'}`),
            h.lon,
            h.lat,
            () => setHotelSel(h),
          ])
        : []
    );
  }, [ready, hotelMode, hotels, hotelSel]);

  // Rejoindre l'autre (perdus dans la foule…) : itinéraire à pied vers sa dernière position.
  const joinPartner = (o) => {
    sessionStorage.removeItem('cdv-join');
    const mm = members[o?.id];
    if (!o || o.lat == null || !mm) return toast("Position de l'autre inconnue : son appli doit être ouverte avec la localisation activée");
    setSel(null);
    setHotelMode(false);
    setRouteFor({ name: mm.name, lat: o.lat, lon: o.lon, isPerson: true, at: o.updatedAtMs });
    focus(o, 16);
  };
  const othersRef = useRef(others);
  othersRef.current = others;
  useEffect(() => {
    let t;
    const go_ = () => {
      if (sessionStorage.getItem('cdv-join') !== '1') return;
      const find = () => othersRef.current.find((x) => x.id === otherMember(memberId));
      if (find()) return joinPartner(find());
      clearTimeout(t);
      t = setTimeout(() => sessionStorage.getItem('cdv-join') === '1' && joinPartner(find()), 3000); // positions pas encore arrivées
    };
    go_();
    addEventListener('cdv-join', go_);
    return () => (removeEventListener('cdv-join', go_), clearTimeout(t));
  }, [others.length, ready]);

  const startGuide = (route, to) => {
    const g = { route, to: { name: to.name, lat: to.lat, lon: to.lon } };
    sessionStorage.setItem('cdv-guide', JSON.stringify(g));
    setRouteFor(null);
    setSel(null);
    setGuide(g);
  };
  const endGuide = () => {
    sessionStorage.removeItem('cdv-guide');
    setGuide(null);
    setFollow(false);
  };
  // Tracé + arrêts sur la carte.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (!m.getSource('guide')) {
      m.addSource('guide', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'guide-casing', type: 'line', source: 'guide', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 10 } });
      m.addLayer({ id: 'guide-line', type: 'line', source: 'guide', filter: ['==', ['get', 'kind'], 'transit'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': 6 } });
      m.addLayer({ id: 'guide-walk', type: 'line', source: 'guide', filter: ['==', ['get', 'kind'], 'walk'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1E6FD9', 'line-width': 5, 'line-dasharray': [0.2, 1.8] } });
    }
    const parts = guide?.route?.parts || [];
    m.getSource('guide').setData({
      type: 'FeatureCollection',
      features: parts.filter((p) => p.coords?.length > 1).map((p) => ({ type: 'Feature', properties: { kind: p.type, color: p.color || '#555' }, geometry: { type: 'LineString', coordinates: p.coords } })),
    });
    const marks = [];
    parts.forEach((p) => {
      if (p.type !== 'transit' || !p.coords?.length) return;
      const [lon, lat] = p.coords[0];
      marks.push([el('mk-stop', `<b style="background:${esc(p.color)};color:${esc(p.textColor)}">${esc(p.line)}</b><span>${esc(p.dep)} · ${esc(p.from)}</span>`), lon, lat, () => toast(`Monter : ${p.vehicle} ${p.line} direction ${p.headsign}, à ${p.dep}`)]);
      const [lon2, lat2] = p.coords[p.coords.length - 1];
      marks.push([el('mk-stop end', `<span>Descendre · ${esc(p.to)}</span>`), lon2, lat2, () => toast(`Descendre à ${p.to} (${p.arr})`)]);
    });
    if (guide?.to) marks.push([el('mk mk-pin', '<i class="fa-solid fa-flag-checkered"></i>', '--c:var(--danger)'), guide.to.lon, guide.to.lat, null]);
    draw('guide', marks);
    const all = parts.flatMap((p) => p.coords || []);
    if (all.length) {
      const b = all.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(all[0], all[0]));
      m.fitBounds(b, { padding: { top: 140, bottom: 260, left: 40, right: 70 }, pitch: 0, bearing: 0, duration: 1200, maxZoom: 17 });
    }
  }, [ready, guide]);
  // Suivi de ma position pendant le guidage.
  useEffect(() => {
    const m = map.current;
    if (!follow || !m) return undefined;
    const stop = (e) => e.originalEvent && setFollow(false); // l'utilisateur déplace la carte : on arrête de suivre
    m.on('dragstart', stop);
    return () => m.off('dragstart', stop);
  }, [follow]);
  useEffect(() => {
    if (follow && me) map.current?.easeTo({ center: [me.lon, me.lat], zoom: Math.max(map.current.getZoom(), 17), duration: 800 });
  }, [follow, me?.lat, me?.lon]);
  // Prochaine étape : l'arrêt où monter tant qu'on n'y est pas, puis l'arrêt où descendre.
  const nextStep = (() => {
    const parts = guide?.route?.parts || [];
    const t = parts.filter((p) => p.type === 'transit' && p.coords?.length);
    if (!t.length) return guide ? { txt: `Marchez jusqu'à ${guide.to.name}`, d: me ? distanceMeters(me, guide.to) : null } : null;
    for (const p of t) {
      const [lon, lat] = p.coords[0];
      const d = me ? distanceMeters(me, { lat, lon }) : null;
      const [lon2, lat2] = p.coords[p.coords.length - 1];
      const dEnd = me ? distanceMeters(me, { lat: lat2, lon: lon2 }) : null;
      if (dEnd != null && dEnd < 80) continue; // étape déjà faite
      if (d == null || d > 60) return { txt: `Rejoindre l'arrêt ${p.from}`, sub: `${p.vehicle} ${p.line} à ${p.dep}, direction ${p.headsign}`, d, p };
      return { txt: `Dans le ${p.vehicle.toLowerCase()} ${p.line} : descendre à ${p.to}`, sub: `${p.stops} arrêt${p.stops > 1 ? 's' : ''} · arrivée ${p.arr}`, d: dEnd, p };
    }
    return { txt: `Marchez jusqu'à ${guide.to.name}`, d: me ? distanceMeters(me, guide.to) : null };
  })();

  const partner = others.find((o) => o.id === otherMember(memberId));
  const gap = me && partner ? distanceMeters(me, partner) : null;
  // Bulles d'info (« Vous êtes ensemble », position refusée) : affichées 8 s, puis masquées
  // jusqu'à ce que la situation change (séparés, éloignés de 500 m de plus…). Un toucher les ferme.
  // Utile seulement : position de l'autre récente (moins de 15 min) et sur place (près de la destination).
  // « Ensemble » : une fois par jour au plus ; « séparés » : quand on s'éloigne d'au moins 300 m.
  const shownKeyRef = useRef(null);
  const fresh = partner?.updatedAtMs && Date.now() - partner.updatedAtMs < 15 * 60000;
  const onSite = me && trip?.city && distanceMeters(me, trip.city) < 50000;
  const today = new Date().toISOString().slice(0, 10);
  const togetherSeen = ls.get('bannerTogether', '') === today;
  const bannerKey =
    gap == null || !fresh || !onSite ? null : gap < 60 ? (togetherSeen && shownKeyRef.current !== 'ensemble' ? null : 'ensemble') : gap > 300 ? `loin:${Math.round(gap / 500)}` : null;
  const [shownKey, setShownKey] = useState(null);
  const [hiddenKey, setHiddenKey] = useState(null);
  useEffect(() => {
    if (!bannerKey || bannerKey === shownKey) return undefined;
    shownKeyRef.current = bannerKey;
    if (bannerKey === 'ensemble') ls.set('bannerTogether', today);
    setShownKey(bannerKey);
    setHiddenKey(null);
    const t = setTimeout(() => setHiddenKey(bannerKey), 8000);
    return () => clearTimeout(t);
  }, [bannerKey]);
  const [errHidden, setErrHidden] = useState(false);
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setErrHidden(true), 10000);
    return () => clearTimeout(t);
  }, [error]);
  const selFromHotel = sel && !sel.isLodging ? distanceMeters(trip?.lodging, sel) : null;
  const selSaved = sel && (sel.id || saved.some((s) => s.osmId && s.osmId === sel.osmId));

  return html`<div class="mapwrap">
    <div id="map" ref=${box}></div>
    ${failed ? html`<div class="map-fail"><${Icon} name="map" /><div>Carte indisponible. Vérifiez la connexion puis rouvrez l'onglet.</div></div>` : null}

    <div class="map-top">
      ${finding
        ? html`<div class="findbox">
            <form class="findbar" onSubmit=${(e) => (e.preventDefault(), runFind(q))}>
              <${Icon} name="magnifying-glass" />
              <input autofocus placeholder=${`Big Ben, glacier, pharmacie… à ${trip?.city?.name || 'proximité'}`} value=${q} onInput=${(e) => onFindInput(e.target.value)} />
              ${findBusy ? html`<span class="spinner" style="width:18px;height:18px;margin:0;border-width:2px"></span>` : null}
              <button type="button" class="iconbtn" onClick=${() => (setFinding(false), setFound(null), setQ(''))} aria-label="Fermer"><${Icon} name="xmark" /></button>
            </form>
            ${found
              ? html`<div class="findlist">
                  ${found.length === 0 ? html`<div class="muted small" style="padding:12px">Aucun résultat.</div>` : null}
                  ${found.map(
                    (p) => html`<button class="finditem" onClick=${() => pickFound(p)}>
                      <${Thumb} place=${p} city=${trip?.city?.name} size=${44} />
                      <span class="grow" style="min-width:0">
                        <b class="ellipsis" style="display:block">${p.name}</b>
                        <small class="muted ellipsis" style="display:block">${[p.rating ? `★ ${p.rating.toFixed(1)}` : '', p.kind, p.address || p.tags?.street].filter(Boolean).join(' · ')}</small>
                      </span>
                      ${p.d != null ? html`<small class="muted">${formatDistance(p.d)}</small>` : null}
                    </button>`
                  )}
                </div>`
              : null}
          </div>`
        : null}
      <div class="chips">
        <${Chip} label="Rechercher" icon="magnifying-glass" active=${finding} onClick=${() => setFinding(!finding)} />
        <${Chip} label="Hôtel idéal" icon="hotel" active=${hotelMode} onClick=${() => (hotelMode ? exitHotelMode() : enterHotelMode())} />
        <${Chip} label="Ouvert maintenant" icon="clock" active=${openOnly} onClick=${() => setOpenOnly(!openOnly)} color="var(--success)" />
        ${CATEGORIES.map((c) => html`<${Chip} label=${c.label} icon=${c.icon} active=${category === c.id} color=${c.color} onClick=${() => pickCategory(c.id)} />`)}
      </div>
      ${category && categoryById(category).subs
        ? html`<div class="chips subchips">
            ${categoryById(category).subs.map(
              (sb) => html`<${Chip} label=${sb.label} icon=${sb.icon} active=${subId === sb.id} color=${categoryById(category).color} onClick=${() => pickSub(sb.id)} />`
            )}
          </div>`
        : null}
      ${bannerKey && hiddenKey !== bannerKey
        ? html`<div class="banner" onClick=${() => setHiddenKey(bannerKey)}>
            <${MemberBadge} member=${members[partner.id]} size=${24} />
            <div class="grow">
              ${gap < 60
                ? html`<b>Vous êtes ensemble</b>`
                : html`<b>${members[partner.id].name} est à ${formatDistance(gap)}</b> · ≈ ${familyWalkMinutes(gap)} min à pied`}
              <span class="muted"> ${ago(partner.updatedAtMs)}</span>
            </div>
          </div>`
        : null}
      ${error === 'denied' && !errHidden
        ? html`<div class="banner" onClick=${() => setErrHidden(true)}><${Icon} name="triangle-exclamation" style="color:var(--warning)" />
            <div class="grow small">Position refusée : Réglages iPhone › Confidentialité › Service de localisation › Sites Safari › « Lorsque l'app est active ».</div></div>`
        : null}
    </div>

    <div class=${`fabs ${sel ? 'hide' : ''}`}>
      ${loading ? html`<div class="spinner" style="margin:0"></div>` : null}
      ${category && !loading ? html`<button class="fab wide" onClick=${() => search(category, subId)}><${Icon} name="rotate" />Chercher ici</button>` : null}
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
      ${routeFor
        ? html`<div class="sheet">
            <div class="row between mb">
              <div><b>${routeFor.isPerson ? `Rejoindre ${routeFor.name}` : `Itinéraire vers ${routeFor.name}`}</b>
                ${routeFor.isPerson ? html`<div class="muted xs">Position ${ago(routeFor.at)}${me ? ` · à ${formatDistance(distanceMeters(me, routeFor))}` : ''}</div>` : null}</div>
              <button class="iconbtn" onClick=${() => setRouteFor(null)} aria-label="Fermer"><${Icon} name="xmark" /></button>
            </div>
            <${TransitPanel}
              origins=${[
                ...(me ? [{ label: 'ma position', icon: 'location-crosshairs', point: me }] : []),
                ...(trip?.lodging && !routeFor.isLodging && !routeFor.isPerson ? [{ label: "l'hôtel", icon: 'bed', point: trip.lodging }] : []),
              ]}
              walk=${!!routeFor.isPerson}
              to=${routeFor}
              city=${trip?.city?.name}
              plansLinks=${false}
              onShow=${(r) => startGuide(r, routeFor)} />
            <div class="row mt" style="gap:6px">
              <button class="pill" onClick=${() => openDirections(routeFor, 'walk')}><${Icon} name="person-walking" /> À pied (Plans)</button>
              <button class="pill" onClick=${() => openDirections(routeFor, 'car')}><${Icon} name="car" /> Voiture</button>
            </div>
          </div>`
        : null}
      ${hotelMode
        ? html`<div class="sheet hotelsheet">
            <div class="row between mb">
              <div><b>Où dormir pour tout voir ?</b><div class="muted xs">Zone idéale entre vos ${targets.length} lieux · temps moyen à pied</div></div>
              <button class="iconbtn" onClick=${exitHotelMode} aria-label="Fermer"><${Icon} name="xmark" /></button>
            </div>
            ${hotels === null ? html`<div class="spinner"></div>` : null}
            ${hotels && !hotels.length ? html`<div class="muted small">Aucun hôtel trouvé ici.</div>` : null}
            ${(hotels || []).slice(0, 12).map(
              (h, i) => html`<div class=${`hotelrow ${hotelSel?.googleId === h.googleId ? 'on' : ''}`} onClick=${() => (setHotelSel(h), focus(h, 16))}>
                <${Thumb} place=${h} city=${trip?.city?.name} size=${54} />
                <div class="grow" style="min-width:0">
                  <b class="ellipsis" style="display:block">${i < 3 ? html`<span class="rank">#${i + 1}</span> ` : null}${h.name}</b>
                  <div class="small muted">${h.rating ? `★ ${h.rating.toFixed(1)} (${h.ratings})` : ''}${h.price ? ` · ${PRICE[h.price] || ''}` : ''}</div>
                  <div class="small"><b style="color:var(--navy)">≈ ${h.avgWalk} min</b> à pied en moyenne · ${h.near}/${targets.length} lieux à moins de 15 min</div>
                  ${hotelSel?.googleId === h.googleId
                    ? html`<div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">
                        <a class="pill accent" href=${bookingUrl(h)} target="_blank" onClick=${(e) => e.stopPropagation()}><${Icon} name="calendar-check" /> Voir prix & réserver</a>
                        <button class="pill" onClick=${(e) => (e.stopPropagation(), go('lieu', { place: h }))}><${Icon} name="circle-info" /> Fiche</button>
                        <button class="pill" onClick=${(e) => (e.stopPropagation(), chooseHotel(h))}><${Icon} name="check" /> On le prend</button>
                      </div>`
                    : null}
                </div>
              </div>`
            )}
            <button class="pill mt" onClick=${() => loadHotels((({ lng, lat }) => ({ lat, lon: lng }))(map.current.getCenter()))}><${Icon} name="rotate" /> Chercher autour du centre de la carte</button>
          </div>`
        : null}
      ${guide && !routeFor && !hotelMode
        ? html`<div class="guidecard">
            <div class="row">
              <div class="gnext"><${Icon} name=${nextStep?.p ? 'bus' : 'person-walking'} /></div>
              <div class="grow" style="min-width:0">
                <b>${nextStep?.txt}</b>
                <div class="small muted">${nextStep?.sub || ''}${nextStep?.d != null ? ` · à ${formatDistance(nextStep.d)}` : ''}</div>
              </div>
            </div>
            <div class="tlines" style="margin-top:8px">${guide.route.parts.map((p) => (p.type === 'transit' ? html`<${LineBadge} p=${p} />` : html`<span class="walkbit"><${Icon} name="person-walking" />${p.min} min</span>`))}</div>
            <div class="row" style="gap:6px;margin-top:8px">
              ${me ? html`<button class=${`pill ${follow ? 'accent' : ''}`} onClick=${() => setFollow(!follow)}><${Icon} name="location-crosshairs" /> ${follow ? 'Je suis suivi' : 'Me suivre'}</button>` : null}
              <button class="pill" onClick=${endGuide}><${Icon} name="xmark" /> Terminer</button>
            </div>
          </div>`
        : null}
      ${sel && !routeFor && !hotelMode
        ? html`<div class="peek" key=${sel.id || sel.osmId || sel.name}>
            <${Thumb} place=${sel} city=${trip?.city?.name} size=${78} />
            <div class="grow" style="min-width:0">
              <div class="peek-title">${sel.name}</div>
              ${sel.rating ? html`<div class="rate-line"><span class="stars" style=${`--r:${sel.rating}`}></span><b>${sel.rating.toFixed(1)}</b><span class="muted xs">(${sel.ratings.toLocaleString('fr-FR')} avis)</span>${sel.openNow != null ? html`<span class=${`open-tag ${sel.openNow ? 'on' : ''}`}>${sel.openNow ? 'Ouvert' : 'Fermé'}</span>` : null}</div>` : null}
              <div class="muted xs">
                ${sel.isLodging ? 'Notre hébergement' : sel.kind || categoryById(sel.category).label}
                ${sel.day ? html` · <b style=${`color:${dayColor(sel.day)}`}>Jour ${sel.day}</b>` : null}
                ${selFromHotel != null ? ` · ${formatDistance(selFromHotel)} de l'hôtel` : ''}
              </div>
              <div class="row" style="margin-top:8px;gap:6px">
                <button class="pill" onClick=${() => go('lieu', { place: sel })}><${Icon} name="circle-info" /> Fiche</button>
                <button class="pill accent" onClick=${() => setRouteFor(sel)}><${Icon} name="route" /> Itinéraire</button>
                ${sel.category === 'hebergement' && !sel.isLodging
                  ? html`<button class="pill" onClick=${() => chooseHotel(sel)}><${Icon} name="bed" /> Notre hôtel</button>`
                  : null}
                ${!sel.isLodging && !selSaved && sel.category !== 'hebergement'
                  ? html`<button class="pill" onClick=${() => (savePlace(tripId, sel, {}, memberId), toast('Ajouté à la boîte à idées'))}><${Icon} name="plus" /> Garder</button>`
                  : null}
              </div>
            </div>
            <button class="iconbtn" onClick=${() => setSel(null)} aria-label="Fermer"><${Icon} name="xmark" /></button>
          </div>`
        : null}
      ${days.length && !guide && !routeFor && !hotelMode
        ? html`<div class="daybar">
            <button class=${`day ${day === -1 ? 'on' : ''}`} style="--c:#5B6B7F" onClick=${() => pickDay(-1)} aria-label="Masquer le planning"><${Icon} name="eye-slash" /> Masquer</button>
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
