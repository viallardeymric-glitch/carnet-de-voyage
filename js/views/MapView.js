// Carte interactive : lieux par catégorie, nos lieux, hôtel, positions E (bleu) et M (rose) en direct.
/* global L */
import { html, useEffect, useMemo, useRef, useState } from '../../vendor/preact.js';
import { useApp, go } from '../core/app.js';
import { useCollection } from '../core/store.js';
import { useLiveLocation } from '../core/location.js';
import { otherMember } from '../core/config.js';
import { CATEGORIES, categoryById } from '../data/categories.js';
import { fetchPlaces } from '../lib/places.js';
import { isOpenNow, loadOpeningHours } from '../lib/openNow.js';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../lib/geo.js';
import { Chip, Icon, MemberBadge } from '../ui/components.js';
import { toast } from '../ui/dialogs.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  return m <= 0 ? "à l'instant" : `il y a ${m} min`;
};

function pinIcon(color, icon, label = '', dot = false) {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${dot ? 'dot' : ''}" style="background:${color}"><i class="fa-solid fa-${icon}"></i>${label ? `<span>${label}</span>` : ''}</div>`,
    iconSize: null,
    iconAnchor: dot ? [9, 9] : [14, 14],
  });
}
function memberIcon(m) {
  return L.divIcon({
    className: '',
    html: `<span class="badge" style="width:34px;height:34px;background:${m.color};font-size:15px">${m.id}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export default function MapView() {
  const { trip, path, memberId, member, members } = useApp();
  const { items: saved } = useCollection(path('places'));
  const { me, others, error } = useLiveLocation();
  const el = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const [category, setCategory] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [showSaved, setShowSaved] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ohReady, setOhReady] = useState(false);
  const [ready, setReady] = useState(0);

  const base = trip?.lodging || trip?.city;

  // Création de la carte (une seule fois)
  useEffect(() => {
    if (!el.current || map.current || !window.L) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView(base ? [base.lat, base.lon] : [48.85, 2.35], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(m);
    layers.current = {
      results: L.layerGroup().addTo(m),
      saved: L.layerGroup().addTo(m),
      people: L.layerGroup().addTo(m),
      lodging: L.layerGroup().addTo(m),
    };
    map.current = m;
    setReady((r) => r + 1);
    setTimeout(() => m.invalidateSize(), 50);
    return () => {
      m.remove();
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
  const visibleResults = useMemo(() => {
    const ids = new Set(saved.map((s) => s.osmId).filter(Boolean));
    return results.filter((r) => !ids.has(r.osmId)).filter((r) => !openOnly || isOpenNow(r, cc) === true);
  }, [results, saved, openOnly, ohReady]);
  const visibleSaved = useMemo(
    () => (showSaved ? saved.filter((s) => s.lat != null) : []).filter((s) => !openOnly || isOpenNow(s, cc) !== false),
    [saved, showSaved, openOnly, ohReady]
  );

  // Hôtel
  useEffect(() => {
    const g = layers.current.lodging;
    if (!g) return;
    g.clearLayers();
    if (trip?.lodging) L.marker([trip.lodging.lat, trip.lodging.lon], { icon: pinIcon('var(--navy)', 'bed') }).bindPopup(`<b>${esc(trip.lodging.name)}</b><br>Notre hébergement`).addTo(g);
  }, [trip?.lodging, ready]);

  // Résultats de recherche
  useEffect(() => {
    const g = layers.current.results;
    if (!g) return;
    g.clearLayers();
    visibleResults.forEach((p) => {
      const cat = categoryById(p.category);
      L.marker([p.lat, p.lon], { icon: pinIcon(cat.color, cat.icon, '', true) })
        .on('click', () => go('lieu', { place: p }))
        .addTo(g);
    });
  }, [visibleResults, ready]);

  // Nos lieux
  useEffect(() => {
    const g = layers.current.saved;
    if (!g) return;
    g.clearLayers();
    visibleSaved.forEach((p) => {
      const cat = categoryById(p.category);
      const color = p.favorite ? 'var(--pink)' : p.status === 'visited' ? 'var(--success)' : cat.color;
      const icon = p.favorite ? 'heart' : p.status === 'visited' ? 'check' : cat.icon;
      L.marker([p.lat, p.lon], { icon: pinIcon(color, icon, p.day ? `J${p.day}` : ''), zIndexOffset: 500 })
        .on('click', () => go('lieu', { place: p }))
        .addTo(g);
    });
  }, [visibleSaved, ready]);

  // Personnes
  useEffect(() => {
    const g = layers.current.people;
    if (!g) return;
    g.clearLayers();
    if (me && member) L.marker([me.lat, me.lon], { icon: memberIcon(member), zIndexOffset: 1000 }).bindPopup(`${esc(member.name)} (moi)`).addTo(g);
    others.forEach((o) => {
      const m = members[o.id];
      if (m) L.marker([o.lat, o.lon], { icon: memberIcon(m), zIndexOffset: 1000 }).bindPopup(`${esc(m.name)} · ${ago(o.updatedAtMs)}`).addTo(g);
    });
  }, [me, others, ready]);

  const partner = others.find((o) => o.id === otherMember(memberId));
  const gap = me && partner ? distanceMeters(me, partner) : null;
  const focus = (p) => p && map.current?.flyTo([p.lat, p.lon], 16, { duration: 0.6 });

  return html`<div class="mapwrap">
    <div id="map" ref=${el}></div>
    <div class="map-top">
      <div class="chips">
        <${Chip} label="Nos lieux" icon="star" active=${showSaved} onClick=${() => setShowSaved(!showSaved)} color="var(--navy)" />
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
    <div class="fabs">
      ${loading ? html`<div class="spinner" style="margin:0"></div>` : null}
      ${category && !loading ? html`<button class="fab wide" onClick=${() => search(category)}><${Icon} name="rotate" />Chercher ici</button>` : null}
      ${me ? html`<button class="fab" onClick=${() => focus(me)} aria-label="Ma position"><${Icon} name="location-crosshairs" /></button>` : null}
      ${partner ? html`<button class="fab" style=${`color:${members[partner.id].color}`} onClick=${() => focus(partner)} aria-label="Conjoint"><${Icon} name="heart" /></button>` : null}
      ${trip?.lodging ? html`<button class="fab" onClick=${() => focus(trip.lodging)} aria-label="Hôtel"><${Icon} name="bed" /></button>` : null}
      <button class="fab" style="color:var(--cyan)" onClick=${() => go('assistant')} aria-label="Assistant"><${Icon} name="wand-magic-sparkles" /></button>
    </div>
  </div>`;
}
