import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { Screen, Card, Row, Body, MemberBadge } from '../components/ui';
import { useTheme } from '../theme';

const ITEMS = [
  { to: 'Assistant', icon: 'sparkles', label: 'Assistant de suggestions', sub: 'Que faire maintenant, selon l\'heure et la météo' },
  { to: 'Checklist', icon: 'checkbox', label: 'Check-list de bagages', sub: 'Partagée et synchronisée' },
  { to: 'Urgences', icon: 'medkit', label: 'Urgences & santé', sub: 'Numéros, hôpitaux et pharmacies proches' },
  { to: 'Journal', icon: 'book', label: 'Journal de bord', sub: 'Photos et souvenirs de chaque jour' },
  { to: 'Voyages', icon: 'airplane', label: 'Changer de voyage', sub: 'Créer ou choisir une destination' },
  { to: 'Reglages', icon: 'settings', label: 'Réglages', sub: 'Profil, code PIN, Face ID, position' },
];

export default function MoreScreen({ navigation }) {
  const t = useTheme();
  const { trip } = useTrip();
  const { member } = useAuth();
  return (
    <Screen>
      <Row style={{ marginBottom: 14 }}>
        {member && <MemberBadge member={member} size={40} />}
        <View style={{ marginLeft: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>Bonjour {member?.name}</Text>
          <Body muted>{trip?.name}</Body>
        </View>
      </Row>
      {ITEMS.map((it) => (
        <Card key={it.to} onPress={() => navigation.navigate(it.to)}>
          <Row>
            <Ionicons name={it.icon} size={24} color={t.cyan} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: t.text }}>{it.label}</Text>
              <Body muted style={{ fontSize: 13 }}>{it.sub}</Body>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
