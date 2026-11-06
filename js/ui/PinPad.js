// Clavier de code PIN façon iPhone.
import { html } from '../../vendor/preact.js';
import { Icon } from './components.js';

export default function PinPad({ value, length, onChange, onBiometrics }) {
  const press = (d) => value.length < length && onChange(value + d);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return html`<div style="display:flex;flex-direction:column;align-items:center">
    <div class="dots">${Array.from({ length }).map((_, i) => html`<span class=${i < value.length ? 'on' : ''}></span>`)}</div>
    <div class="pad">
      ${keys.map((k) => {
        if (k === 'bio')
          return onBiometrics
            ? html`<button class="plain" onClick=${onBiometrics} aria-label="Face ID"><${Icon} name="face-smile" /></button>`
            : html`<span></span>`;
        if (k === 'del')
          return html`<button class="plain" onClick=${() => onChange(value.slice(0, -1))} aria-label="Effacer"><${Icon} name="delete-left" /></button>`;
        return html`<button onClick=${() => press(k)}>${k}</button>`;
      })}
    </div>
  </div>`;
}
