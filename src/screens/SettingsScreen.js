import React, { useEffect, useState } from 'react';
import { View, Text, Switch, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../context/AuthContext';
import { useLock, biometricsAvailable } from '../context/LockContext';
import { useSharingPreference } from '../hooks/useLiveLocation';
import { AI_KEY } from '../services/assistant';
import { MEMBERS } from '../config/settings';
import { Screen, Subtitle, Card, Row, Body, Button, Input, Chip } from '../components/ui';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const t = useTheme();
  const { user, memberId, setMemberId, logout } = useAuth();
  const { useBiometrics, setUseBiometrics, resetPin, lock } = useLock();
  const [sharing, setSharing] = useSharingPreference();
  const [bioOk, setBioOk] = useState(false);
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    biometricsAvailable().then(setBioOk);
    SecureStore.getItemAsync(AI_KEY).then((k) => setHasKey(!!k));
  }, []);

  return (
    <Screen>
      <Subtitle>Profil</Subtitle>
      <Card>
        <Body muted>Connecté : {user?.email}</Body>
        <Row style={{ marginTop: 10 }}>
          {Object.values(MEMBERS).map((m) => (
            <Chip key={m.id} label={`Je suis ${m.name}`} active={memberId === m.id} color={m.color} onPress={() => setMemberId(m.id)} />
          ))}
        </Row>
      </Card>

      <Subtitle>Sécurité</Subtitle>
      <Card>
        <Toggle t={t} label="Face ID / Touch ID" sub={bioOk ? 'Déverrouillage rapide' : 'Non disponible sur cet appareil'} value={useBiometrics && bioOk} onChange={setUseBiometrics} disabled={!bioOk} />
        <Button title="Verrouiller maintenant" icon="lock-closed" variant="ghost" small onPress={lock} />
        <Button
          title="Changer de code PIN"
          icon="keypad"
          variant="ghost"
          small
          onPress={() => Alert.alert('Changer de code ?', 'Vous allez choisir un nouveau code.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer', onPress: resetPin },
          ])}
        />
      </Card>

      <Subtitle>Position</Subtitle>
      <Card>
        <Toggle t={t} label="Partager ma position" sub="Visible uniquement par votre conjoint(e), quand l'app est ouverte" value={sharing} onChange={setSharing} />
      </Card>

      <Subtitle>Assistant IA (optionnel)</Subtitle>
      <Card>
        <Body muted style={{ marginBottom: 8 }}>
          {hasKey ? 'Une clé est enregistrée (dans le trousseau sécurisé de l\'iPhone).' : 'Collez une clé API Claude (console.anthropic.com) pour activer les questions libres.'}
        </Body>
        <Input value={key} onChangeText={setKey} placeholder="sk-ant-…" autoCapitalize="none" secureTextEntry />
        <Row>
          <Button
            title="Enregistrer"
            small
            style={{ flex: 1, marginRight: 6 }}
            disabled={!key}
            onPress={async () => { await SecureStore.setItemAsync(AI_KEY, key.trim()); setKey(''); setHasKey(true); }}
          />
          {hasKey && (
            <Button title="Supprimer" small variant="ghost" style={{ flex: 1, marginLeft: 6 }} onPress={async () => { await SecureStore.deleteItemAsync(AI_KEY); setHasKey(false); }} />
          )}
        </Row>
      </Card>

      <Button title="Se déconnecter" icon="log-out" variant="danger" onPress={logout} style={{ marginTop: 16 }} />
    </Screen>
  );
}

function Toggle({ t, label, sub, value, onChange, disabled }) {
  return (
    <Row style={{ paddingVertical: 8 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: '600' }}>{label}</Text>
        {sub ? <Body muted style={{ fontSize: 12 }}>{sub}</Body> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: t.cyan }} />
    </Row>
  );
}
