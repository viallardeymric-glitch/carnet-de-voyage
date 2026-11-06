import React from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { MEMBERS } from '../config/settings';
import { Screen, Title, Body, Card, MemberBadge, Row, Button } from '../components/ui';

export default function ProfileSetupScreen() {
  const { setMemberId, user, logout } = useAuth();
  return (
    <Screen style={{ paddingTop: 80 }}>
      <Title>Qui utilise ce téléphone ?</Title>
      <Body muted style={{ marginBottom: 16 }}>
        Connecté avec {user?.email}. Ce choix détermine votre marqueur sur la carte.
      </Body>
      {Object.values(MEMBERS).map((m) => (
        <Card key={m.id} onPress={() => setMemberId(m.id)}>
          <Row>
            <MemberBadge member={m} size={44} />
            <View style={{ marginLeft: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: m.color }}>Je suis {m.name}</Text>
              <Body muted>Marqueur {m.id === 'E' ? 'bleu' : 'rose'} « {m.id} »</Body>
            </View>
          </Row>
        </Card>
      ))}
      <Button title="Changer de compte" variant="ghost" onPress={logout} />
    </Screen>
  );
}
