// Verrouillage de l'app : code PIN (haché) + Face ID / Touch ID.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { AUTO_LOCK_SECONDS } from '../config/settings';

const LockContext = createContext(null);
const PIN_KEY = 'lock_pin_hash';
const SALT_KEY = 'lock_pin_salt';
const BIO_KEY = 'lock_biometrics';

async function hashPin(pin, salt) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function biometricsAvailable() {
  const [hw, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hw && enrolled;
}

export async function askBiometrics(reason = 'Déverrouiller Carnet de Voyage') {
  if (!(await biometricsAvailable())) return false;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Code PIN',
    disableDeviceFallback: true,
  });
  return res.success;
}

export function LockProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [locked, setLocked] = useState(true);
  const [useBiometrics, setUseBiometricsState] = useState(true);
  const backgroundAt = useRef(null);

  useEffect(() => {
    (async () => {
      const [h, bio] = await Promise.all([
        SecureStore.getItemAsync(PIN_KEY),
        SecureStore.getItemAsync(BIO_KEY),
      ]);
      setHasPin(!!h);
      setUseBiometricsState(bio !== 'off');
      setReady(true);
    })();
  }, []);

  // Reverrouillage automatique au retour d'arrière-plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current) {
        const away = (Date.now() - backgroundAt.current) / 1000;
        backgroundAt.current = null;
        if (away > AUTO_LOCK_SECONDS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const setPin = async (pin) => {
    const salt = Crypto.randomUUID();
    await SecureStore.setItemAsync(SALT_KEY, salt);
    await SecureStore.setItemAsync(PIN_KEY, await hashPin(pin, salt));
    await SecureStore.setItemAsync('lock_pin_length', String(pin.length));
    setHasPin(true);
    setLocked(false);
  };

  const checkPin = async (pin) => {
    const [salt, h] = await Promise.all([
      SecureStore.getItemAsync(SALT_KEY),
      SecureStore.getItemAsync(PIN_KEY),
    ]);
    const ok = h && (await hashPin(pin, salt)) === h;
    if (ok) setLocked(false);
    return ok;
  };

  const unlockWithBiometrics = async () => {
    const ok = await askBiometrics();
    if (ok) setLocked(false);
    return ok;
  };

  const setUseBiometrics = async (v) => {
    setUseBiometricsState(v);
    await SecureStore.setItemAsync(BIO_KEY, v ? 'on' : 'off');
  };

  const resetPin = async () => {
    await SecureStore.deleteItemAsync(PIN_KEY);
    await SecureStore.deleteItemAsync(SALT_KEY);
    setHasPin(false);
  };

  return (
    <LockContext.Provider
      value={{
        ready,
        hasPin,
        locked,
        lock: () => setLocked(true),
        setPin,
        checkPin,
        unlockWithBiometrics,
        useBiometrics,
        setUseBiometrics,
        resetPin,
      }}
    >
      {children}
    </LockContext.Provider>
  );
}

export const useLock = () => useContext(LockContext);
