// Composants d'interface réutilisables.
import { html, useState, useEffect } from '../../vendor/preact.js';
import { setDialogHost, promptBox } from './dialogs.js';
import { findPhoto, cachedPhoto } from '../lib/photos.js';
import { categoryById } from '../data/categories.js';

export const Icon = ({ name, style, cls = '' }) => html`<i class="fa-solid fa-${name} ${cls}" style=${style}></i>`;

export const Card = ({ children, onClick, style, cls = '' }) =>
  html`<div class=${`card ${onClick ? 'tap' : ''} ${cls}`} onClick=${onClick} style=${style}>${children}</div>`;

export function Button({ title, icon, onClick, variant = '', small, disabled, loading, style, cls = '' }) {
  return html`<button
    class=${`btn ${variant} ${small ? 'sm' : ''} ${!title ? 'icon' : ''} ${cls}`}
    onClick=${onClick}
    disabled=${disabled || loading}
    style=${style}
  >
    ${loading ? html`<span class="spinner" style="width:18px;height:18px;margin:0;border-width:2px"></span>` : icon ? html`<${Icon} name=${icon} />` : null}
    ${title}
  </button>`;
}

export const Chip = ({ label, icon, active, onClick, color }) =>
  html`<button class=${`chip ${active ? 'active' : ''}`} style=${color ? `--chip:${color}` : ''} onClick=${onClick}>
    ${icon ? html`<${Icon} name=${icon} />` : null}${label}
  </button>`;

export const Subtitle = ({ children }) => html`<div class="subtitle">${children}</div>`;

export function SafetyBox({ title = 'Points Sécurité & Santé', children, icon = 'kit-medical' }) {
  return html`<div class="safety"><h4><${Icon} name=${icon} />${title}</h4>${children}</div>`;
}

export const Empty = ({ icon = 'wand-magic-sparkles', text }) =>
  html`<div class="empty"><${Icon} name=${icon} />${text}</div>`;

export const Spinner = () => html`<div class="spinner"></div>`;

export const MemberBadge = ({ member, size = 28 }) =>
  html`<span class="badge" style=${`width:${size}px;height:${size}px;background:${member.color};font-size:${size * 0.45}px`}>${member.id}</span>`;

export function Input({ label, multiline, onInput, value, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input';
  return html`<div>
    ${label ? html`<label class="lbl">${label}</label>` : null}
    <${Tag} class="input" value=${value} onInput=${(e) => onInput?.(e.target.value)} ...${rest} />
  </div>`;
}

export const Switch = ({ checked, onChange, disabled }) =>
  html`<label class="switch"><input type="checkbox" checked=${checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} /><span></span></label>`;

// Hôte global des feuilles d'actions (voir dialogs.js).
export function DialogHost() {
  const [d, setD] = useState(null);
  useEffect(() => setDialogHost(setD), []);
  // Changer d'écran (retour, menu) referme la fenêtre ouverte, comme « Annuler ».
  useEffect(() => {
    if (!d) return undefined;
    const off = () => (setD(null), d.resolve(null));
    window.addEventListener('hashchange', off);
    return () => window.removeEventListener('hashchange', off);
  }, [d]);
  if (!d) return null;
  const close = (v) => {
    setD(null);
    d.resolve(v);
  };
  return html`<div class="overlay" onClick=${() => close(null)}>
    <div class="sheet" onClick=${(e) => e.stopPropagation()}>
      ${d.title ? html`<h3>${d.title}</h3>` : null}
      ${d.message ? html`<div class="muted small mb">${d.message}</div>` : null}
      ${d.input
        ? html`<input class="input" inputmode="decimal" autofocus value=${(promptBox.value = d.input.value)} onInput=${(e) => (promptBox.value = e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && close(d.options[0]?.value)} />`
        : null}
      ${d.options.map((o) => html`<button class=${`opt ${o.danger ? 'danger' : ''}`} onClick=${() => close(o.value)}>${o.label}</button>`)}
      <button class="opt cancel" onClick=${() => close(null)}>Annuler</button>
    </div>
  </div>`;
}

// Miniature d'un lieu : photo Wikipédia si on en trouve une, sinon pastille colorée de la catégorie.
export function Thumb({ place, city, size = 58 }) {
  const cat = categoryById(place?.category);
  const [url, setUrl] = useState(() => (place ? cachedPhoto(place) : null));
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    let alive = true;
    setBroken(false);
    const hit = place ? cachedPhoto(place) : null;
    setUrl(hit);
    if (place && hit === undefined) findPhoto(place, { city }).then((u) => alive && setUrl(u || null));
    return () => (alive = false);
  }, [place?.osmId, place?.id, place?.name]);
  const box = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;--c:${cat.color}`;
  return url && !broken
    ? html`<img class="thumb" src=${url} alt="" loading="lazy" style=${box} onError=${() => setBroken(true)} />`
    : html`<div class=${`thumb thumb-icon ${url === undefined ? 'loading' : ''}`} style=${box}><${Icon} name=${cat.icon} /></div>`;
}
