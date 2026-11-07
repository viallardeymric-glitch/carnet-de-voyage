// Photos en plein écran : on fait défiler du doigt, une croix en haut à droite pour fermer.
import { html, render, useEffect, useRef, useState } from '../../vendor/preact.js';
import { Icon } from './components.js';

function PhotoViewer({ photos, start = 0, title = '', onClose }) {
  const strip = useRef(null);
  const [i, setI] = useState(start);
  useEffect(() => {
    const s = strip.current;
    if (s) s.scrollLeft = start * s.clientWidth;
    const key = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const onScroll = (e) => setI(Math.round(e.target.scrollLeft / e.target.clientWidth));
  return html`<div class="pviewer" role="dialog" aria-label="Photos">
    <div class="pv-top">
      <span class="pv-title">${title}${photos.length > 1 ? html` <small>${i + 1} / ${photos.length}</small>` : null}</span>
      <button class="pv-close" onClick=${onClose} aria-label="Fermer"><${Icon} name="xmark" /></button>
    </div>
    <div class="pv-strip" ref=${strip} onScroll=${onScroll}>
      ${photos.map((u) => html`<div class="pv-slide"><img src=${u} alt="" /></div>`)}
    </div>
  </div>`;
}

// Ouvre la visionneuse au-dessus de toute l'app (en-tête compris).
export function openPhotos(photos, start = 0, title = '') {
  if (!photos?.length) return;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const close = () => {
    render(null, host);
    host.remove();
  };
  render(html`<${PhotoViewer} photos=${photos} start=${start} title=${title} onClose=${close} />`, host);
}
