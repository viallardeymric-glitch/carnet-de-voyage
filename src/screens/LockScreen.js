import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useLock, biometricsAvailable } from '../context/LockContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme';
import PinPad from '../components/PinPad';
import { Title, Body, Button, MemberBadge } from '../components/ui';

const LEN_KEY = 'lock_pin_length';

export default function LockScreen() {
  const t = useTheme();
  const { checkPin, unlockWithBiometrics, useBiometrics, resetPin } = useLock();
  const { member, logout } = useAuth();
  const [value, setValue] = useState('');
  const [length, setLength] = useState(null);
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(LEN_KEY).then((l) => setLength(Number(l) || null));
    biometricsAvailable().then((ok) => {
      setBio(ok && useBiometrics);
      if (ok && useBiometrics) unlockWithBiometrics();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = async (v) => {
    setError('');
    setValue(v);
    if (v.length < (length || 6)) return;
    if (Date.now() < waitUntil) {
      setError('Trop d\'essais : patientez 30 secondes.');
      setValue('');
      return;
    }
    if (await checkPin(v)) return;
    const f = fails + 1;
    setFails(f);
    if (f >= 5) {
      setWaitUntil(Date.now() + 30000);
      setFails(0);
    }
    setError('Code incorrect');
    setValue('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 70, alignItems: 'center' }}>
      {member && <MemberBadge member={member} size={56} />}
      <Title style={{ marginTop: 12 }}>Bonjour {member?.name}</Title>
      <Body muted>Saisissez votre code {bio ? 'ou utilisez Face ID' : ''}</Body>
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <PinPad
        value={value}
        length={length || 6}
        onChange={onChange}
        onBiometrics={bio ? unlockWithBiometrics : null}
      />
      <Button
        title="Code oublié ? Se reconnecter"
        variant="ghost"
        small
        onPress={async () => {
          await resetPin();
          await logout();
        }}
      />
    </View>
  );
}
