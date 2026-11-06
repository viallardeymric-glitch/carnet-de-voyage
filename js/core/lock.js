// Verrouillage : code PIN (dérivé PBKDF2, jamais stocké en clair) + Face ID / Touch ID
// via WebAuthn (clé d'accès de l'appareil, vérification biométrique obligatoire).
import { ls, AUTO_LOCK_SECONDS } from './config.js';

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function derive(pin, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, key, 256);
  return toHex(bits);
}

export const hasPin = () => !!ls.get('pin');
export const pinLength = () => ls.get('pin')?.length || 4;

export async function setPin(pin) {
  const salt = toHex(rand(16));
  ls.set('pin', { salt, hash: await derive(pin, salt), length: pin.length });
}

export async function checkPin(pin) {
  const p = ls.get('pin');
  if (!p) return false;
  return (await derive(pin, p.salt)) === p.hash;
}

export const resetPin = () => ls.set('pin', null);

// Anti-essais : 5 erreurs => 30 s d'attente, puis doublement.
export function pinThrottle() {
  const t = ls.get('pinFails', { n: 0, until: 0 });
  return t;
}
export function registerFail() {
  const t = pinThrottle();
  const n = t.n + 1;
  const until = n % 5 === 0 ? Date.now() + 30000 * 2 ** (n / 5 - 1) : t.until;
  ls.set('pinFails', { n, until });
}
export const clearFails = () => ls.set('pinFails', { n: 0, until: 0 });

// ---------------------------------------------------------------- Face ID (WebAuthn)
export const biometricsSupported = async () =>
  !!window.PublicKeyCredential &&
  (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false));

export const biometricsEnabled = () => !!ls.get('webauthn');

export async function enableBiometrics(memberName) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'Carnet de Voyage', id: location.hostname },
      user: { id: rand(16), name: `${memberName} · Carnet de Voyage`, displayName: memberName },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  ls.set('webauthn', { id: toB64(cred.rawId) });
}

export const disableBiometrics = () => ls.set('webauthn', null);

// Doit être appelé depuis un geste de l'utilisateur (toucher un bouton) sur iPhone.
export async function verifyBiometrics() {
  const w = ls.get('webauthn');
  if (!w) return false;
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: fromB64(w.id) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!res && res.response?.authenticatorData != null;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- reverrouillage automatique
export function watchAutoLock(onLock) {
  let hiddenAt = null;
  const handler = () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && (Date.now() - hiddenAt) / 1000 > AUTO_LOCK_SECONDS) {
      hiddenAt = null;
      onLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

// Session déverrouillée : une fois l'app ouverte (Face ID ou code), le coffre ne redemande rien
// tant que l'app ne s'est pas reverrouillée (plus d'une minute en arrière-plan).
let sessionOpen = false;
export const markSession = (v) => (sessionOpen = v);
export const sessionUnlocked = () => sessionOpen;
