// Urgences : numéros du pays, hôpitaux et pharmacies proches, notes médicales partagées.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTrip } from '../context/TripContext';
import { useDocument } from '../hooks/useCollection';
import { emergencyFor, PREGNANCY_TIPS } from '../data/emergency';
import { fetchHealth } from '../services/places';
import { distanceMeters, formatDistance } from '../services/geo';
import { openDirections } from '../services/routing';
import { Screen, Subtitle, Card, Row, Body, Input, SafetyBox, Button } from '../components/ui';
import { useTheme } from '../theme';

export default function EmergencyScreen() {
  const t = useTheme();
  const { trip, path } = useTrip();
  const info = emergencyFor(trip?.city?.countryCode);
  const notesDoc = useDocument(path('meta/medical'));
  const [notes, setNotes] = useState('');
  const [health, setHealth] = useState(null);
  const [origin, setOrigin] = useState(null);

  useEffect(() => setNotes(notesDoc?.text || ''), [notesDoc?.text]);

  const load = async () => {
    setHealth(null);
    let o = trip?.lodging || trip?.city;
    try {
      const l = await Location.getLastKnownPositionAsync();
      if (l) o = { lat: l.coords.latitude, lon: l.coords.longitude };
    } catch {}
    setOrigin(o);
    try {
      const list = await fetchHealth(o);
      setHealth(list.map((p) => ({ ...p, d: distanceMeters(o, p) })).sort((a, b) => a.d - b.d));
    } catch {
      setHealth([]);
    }
  };
  useEffect(() => {
    if (trip) load();
  }, [trip?.id]);

  const call = (n) => Linking.openURL(`tel:${n}`);
  const hospitals = (health || []).filter((h) => h.isHospital).slice(0, 4);
  const pharmacies = (health || []).filter((h) => !h.isHospital).slice(0, 4);

  return (
    <Screen>
      <TouchableOpacity onPress={() => call(info.general)} style={{ backgroundColor: t.danger, borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <Row>
          <Ionicons name="call" size={28} color="#fff" />
          <View style={{ marginLeft: 12 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>Appeler le {info.general}</Text>
            <Text style={{ color: '#fff' }}>Urgences · {trip?.city?.country}</Text>
          </View>
        </Row>
      </TouchableOpacity>

      <Card>
        {[['Ambulance / SAMU', info.ambulance], ['Police', info.police], ['Pompiers', info.fire], ...(info.extra || [])].map(([label, n]) => (
          <TouchableOpacity key={label} onPress={() => call(n)}>
            <Row style={{ paddingVertical: 8, justifyContent: 'space-between' }}>
              <Body style={{ flex: 1 }}>{label}</Body>
              <Text style={{ color: t.cyan, fontWeight: '800', fontSize: 17 }}>{n}</Text>
            </Row>
          </TouchableOpacity>
        ))}
      </Card>

      {info.tips && (
        <SafetyBox title={`Bon à savoir · ${trip?.city?.country}`}>
          {info.tips.map((tip) => <Body key={tip} style={{ marginBottom: 4 }}>• {tip}</Body>)}
        </SafetyBox>
      )}

      <SafetyBox title="Grossesse : points de vigilance">
        {PREGNANCY_TIPS.map((tip) => <Body key={tip} style={{ marginBottom: 4 }}>• {tip}</Body>)}
      </SafetyBox>

      <Row style={{ justifyContent: 'space-between' }}>
        <Subtitle>Hôpitaux les plus proches</Subtitle>
        <TouchableOpacity onPress={load}><Ionicons name="refresh" size={18} color={t.cyan} /></TouchableOpacity>
      </Row>
      {!health && <ActivityIndicator color={t.cyan} />}
      {health && hospitals.length === 0 && <Body muted>Aucun hôpital trouvé à proximité (ou pas de réseau).</Body>}
      {hospitals.map((h) => <HealthRow key={h.osmId} h={h} t={t} />)}
      <Subtitle>Pharmacies</Subtitle>
      {pharmacies.map((h) => <HealthRow key={h.osmId} h={h} t={t} />)}
      {origin && <Body muted style={{ fontSize: 12 }}>Distances depuis {origin === trip?.lodging ? "l'hôtel" : 'votre position'}.</Body>}

      <Subtitle>Nos notes médicales (partagées)</Subtitle>
      <Input
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top' }}
        value={notes}
        onChangeText={setNotes}
        placeholder="Groupe sanguin, terme prévu, allergies, traitement, médecin / sage-femme en France…"
      />
      <Button title="Enregistrer" icon="save" onPress={() => setDoc(doc(db, path('meta/medical')), { text: notes })} />
    </Screen>
  );
}

function HealthRow({ h, t }) {
  return (
    <Card style={{ paddingVertical: 10 }}>
      <Row>
        <Ionicons name={h.isHospital ? 'medical' : 'bandage'} size={20} color={t.danger} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ color: t.text, fontWeight: '700' }}>{h.name}</Text>
          <Text style={{ color: t.muted, fontSize: 12 }}>
            {formatDistance(h.d)}
            {h.tags.emergency === 'yes' ? ' · urgences' : ''}
            {h.tags.opening_hours ? ` · ${h.tags.opening_hours}` : ''}
          </Text>
        </View>
        {h.tags.phone ? (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${h.tags.phone.replace(/\s/g, '')}`)} style={{ padding: 6 }}>
            <Ionicons name="call" size={20} color={t.cyan} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => openDirections(h, 'car')} style={{ padding: 6 }}>
          <Ionicons name="navigate" size={20} color={t.cyan} />
        </TouchableOpacity>
      </Row>
    </Card>
  );
}
