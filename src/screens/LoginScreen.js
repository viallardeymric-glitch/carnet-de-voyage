import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Screen, Title, Body, Button, Input, Card } from '../components/ui';
import { useTheme } from '../theme';

const ERRORS = {
  'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  'auth/invalid-email': 'Adresse email invalide.',
  'auth/too-many-requests': 'Trop d\'essais. Patientez quelques minutes.',
  'auth/network-request-failed': 'Pas de connexion Internet.',
};

export default function LoginScreen() {
  const t = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (e) {
      setError(ERRORS[e.code] || e.message);
    }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen style={{ paddingTop: 90 }}>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ backgroundColor: t.navy, borderRadius: 24, padding: 18 }}>
            <Ionicons name="airplane" size={44} color={t.cyan} />
          </View>
          <Title style={{ marginTop: 14, fontSize: 26 }}>Carnet de Voyage</Title>
          <Body muted>Notre famille, nos voyages, en toute sécurité.</Body>
        </View>
        <Card>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {error ? <Text style={{ color: t.danger, marginBottom: 8 }}>{error}</Text> : null}
          <Button title="Se connecter" icon="log-in" onPress={submit} loading={busy} disabled={!email || !password} />
        </Card>
        <Body muted style={{ textAlign: 'center', fontSize: 13 }}>
          Les comptes sont créés une fois pour toutes dans la console Firebase (voir le guide).
        </Body>
      </Screen>
    </KeyboardAvoidingView>
  );
}
