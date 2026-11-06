import { html, useState } from '../../vendor/preact.js';
import { fb, auth } from '../core/store.js';
import { setFirebaseConfig } from '../core/config.js';
import { Card, Button, Input } from '../ui/components.js';
import { confirm } from '../ui/dialogs.js';

const ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/too-many-requests': "Trop d'essais. Patientez quelques minutes.",
  'auth/network-request-failed': 'Pas de connexion Internet.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Configuration Firebase invalide (apiKey).',
};

export default function LoginView() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fb.signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(ERRORS[err.code] || err.message);
    }
    setBusy(false);
  };

  const disable = async () => {
    if (await confirm('Utiliser sans synchronisation ?', 'Les données resteront sur ce téléphone uniquement.', 'Continuer sans synchro', false)) {
      setFirebaseConfig(null);
      location.reload();
    }
  };

  return html`<div class="page" style="padding-top:calc(var(--safe-top) + 50px)">
    <div class="center mb">
      <img src="icons/icon-192.png" class="logo" alt="" />
      <h1 class="title" style="margin-top:14px">Connexion</h1>
      <div class="muted">Avec le compte créé dans Firebase.</div>
    </div>
    <${Card}>
      <form onSubmit=${submit}>
        <${Input} label="Email" type="email" autocomplete="username" value=${email} onInput=${setEmail} />
        <${Input} label="Mot de passe" type="password" autocomplete="current-password" value=${password} onInput=${setPassword} />
        ${error ? html`<div class="error">${error}</div>` : null}
        <${Button} title="Se connecter" icon="right-to-bracket" loading=${busy} disabled=${!email || !password} />
      </form>
    </${Card}>
    <${Button} title="Utiliser sans synchronisation" variant="ghost" small onClick=${disable} style="width:100%" />
  </div>`;
}
