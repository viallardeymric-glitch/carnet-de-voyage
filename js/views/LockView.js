import { html, useEffect, useState } from '../../vendor/preact.js';
import { useApp } from '../core/app.js';
import { checkPin, pinLength, biometricsEnabled, verifyBiometrics, pinThrottle, registerFail, clearFails, resetPin } from '../core/lock.js';
import PinPad from '../ui/PinPad.js';
import { Button, MemberBadge } from '../ui/components.js';
import { confirm } from '../ui/dialogs.js';

export default function LockView() {
  const { member, unlock, mode, logout, pinChanged } = useApp();
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const len = pinLength();
  const bio = biometricsEnabled();
  const [showPad, setShowPad] = useState(!bio);

  const onChange = async (v) => {
    setError('');
    setValue(v);
    if (v.length < len) return;
    const t = pinThrottle();
    if (Date.now() < t.until) {
      setError(`Trop d'essais : patientez ${Math.ceil((t.until - Date.now()) / 1000)} s.`);
      return setValue('');
    }
    if (await checkPin(v)) {
      clearFails();
      unlock();
    } else {
      registerFail();
      setError('Code incorrect');
      setValue('');
    }
  };

  const faceId = async () => {
    if (await verifyBiometrics()) {
      clearFails();
      unlock();
    } else {
      setError('Face ID non reconnu : réessayez ou utilisez le code.');
      setShowPad(true);
    }
  };
  // Face ID se lance tout seul à l'ouverture (si l'iPhone l'autorise sans toucher l'écran).
  useEffect(() => {
    if (!bio) return;
    verifyBiometrics().then((ok) => ok && (clearFails(), unlock()));
  }, []);

  const forgot = async () => {
    const msg =
      mode === 'firebase'
        ? 'Vous allez vous reconnecter avec votre email et choisir un nouveau code.'
        : "Sans synchronisation, réinitialiser le code efface le coffre-fort de ce téléphone (par sécurité). Le planning et le budget sont conservés.";
    if (!(await confirm('Code oublié ?', msg, 'Réinitialiser'))) return;
    if (mode === 'firebase') await logout();
    else indexedDB.deleteDatabase('cdv-coffre');
    resetPin();
    pinChanged();
  };

  return html`<div class="lock">
    ${member ? html`<${MemberBadge} member=${member} size=${56} />` : null}
    <h1 class="title" style="margin-top:12px">Bonjour ${member?.name}</h1>
    ${error ? html`<div class="error">${error}</div>` : null}
    ${bio && !showPad
      ? html`<button class="faceid" onClick=${faceId}><i class="fa-solid fa-face-smile"></i><span>Toucher pour ouvrir avec Face ID</span></button>
          <button class="btn ghost sm" style="margin-top:24px" onClick=${() => setShowPad(true)}>Utiliser mon code</button>`
      : html`<div class="muted">Saisissez votre code${bio ? ' ou utilisez Face ID' : ''}</div>
          <${PinPad} value=${value} length=${len} onChange=${onChange} onBiometrics=${bio ? faceId : null} />
          <button class="btn ghost sm" style="margin-top:18px" onClick=${forgot}>Code oublié ?</button>`}
  </div>`;
}
