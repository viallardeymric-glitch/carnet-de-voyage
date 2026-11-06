import { html, useState, useEffect } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { setPin, biometricsSupported, enableBiometrics } from '../core/lock.js';
import PinPad from '../ui/PinPad.js';
import { Chip, Button } from '../ui/components.js';

export default function PinSetupView() {
  const { pinChanged, member } = useApp();
  const [length, setLength] = useState(4);
  const [first, setFirst] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('pin');
  const [bio, setBio] = useState(false);

  useEffect(() => {
    biometricsSupported().then(setBio);
  }, []);

  const onChange = async (v) => {
    setError('');
    if (v.length < length) return setValue(v);
    if (!first) {
      setFirst(v);
      setValue('');
    } else if (v === first) {
      setValue(v);
      await setPin(v);
      if (bio) setStep('bio');
      else pinChanged();
    } else {
      setError('Les codes ne correspondent pas, recommencez.');
      setFirst(null);
      setValue('');
    }
  };

  const activate = async () => {
    try {
      await enableBiometrics(member.name);
    } catch {
      // refus ou annulation : le code PIN suffit
    }
    pinChanged();
  };

  if (step === 'bio')
    return html`<div class="lock">
      <div style="font-size:54px;color:var(--cyan)"><i class="fa-solid fa-face-smile"></i></div>
      <h1 class="title">Activer Face ID ?</h1>
      <p class="muted center">Pour déverrouiller l'app et le coffre-fort d'un regard. Le code PIN reste disponible.</p>
      <${Button} title="Activer Face ID" icon="face-smile" onClick=${activate} />
      <${Button} title="Plus tard" variant="ghost" onClick=${pinChanged} />
    </div>`;

  return html`<div class="lock">
    <h1 class="title">${first ? 'Confirmez le code' : 'Choisissez un code PIN'}</h1>
    <p class="muted center" style="margin:0">Il protège l'app et vos billets.</p>
    ${!first
      ? html`<div class="row mt">
          <${Chip} label="4 chiffres" active=${length === 4} onClick=${() => (setLength(4), setValue(''))} />
          <${Chip} label="6 chiffres" active=${length === 6} onClick=${() => (setLength(6), setValue(''))} />
        </div>`
      : null}
    ${error ? html`<div class="error">${error}</div>` : null}
    <${PinPad} value=${value} length=${length} onChange=${onChange} />
  </div>`;
}
