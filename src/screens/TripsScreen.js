// Liste des voyages + création (n'importe quelle ville du monde).
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCollection } from '../hooks/useCollection';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { searchCities, searchAddress } from '../services/places';
import { createTrip, createLondonTrip } from '../services/trips';
import { frToISO, formatShort } from '../services/dates';
import { Screen, Title, Subtitle, Body, Card, Button, Input, Row, Empty } from '../components/ui';
import { useTheme } from '../theme';

export default function TripsScreen({ navigation }) {
  const t = useTheme();
  const { items: trips } = useCollection('trips', (a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const { tripId, setTripId } = useTrip();
  const { memberId } = useAuth();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [cityQuery, setCityQuery] = useState('');
  const [cities, setCities] = useState([]);
  const [city, setCity] = useState(null);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [lodgingQuery, setLodgingQuery] = useState('');
  const [lodgings, setLodgings] = useState([]);
  const [lodging, setLodging] = useState(null);

  const choose = (id) => {
    setTripId(id);
    if (navigation.canGoBack()) navigation.goBack();
  };

  const london = async () => {
    setBusy(true);
    try {
      const id = await createLondonTrip(memberId);
      choose(id);
    } catch (e) {
      Alert.alert('Oups', e.message);
    }
    setBusy(false);
  };

  const save = async () => {
    const s = frToISO(start);
    const e = frToISO(end);
    if (!city || !s || !e || e < s) {
      Alert.alert('Il manque quelque chose', 'Choisissez une ville et des dates au format JJ/MM/AAAA.');
      return;
    }
    setBusy(true);
    try {
      const id = await createTrip(
        { name: name || `Voyage à ${city.name}`, city, startDate: s, endDate: e, lodging: lodging || null },
        memberId
      );
      setCreating(false);
      choose(id);
    } catch (err) {
      Alert.alert('Oups', err.message);
    }
    setBusy(false);
  };

  return (
    <Screen>
      {!creating && (
        <>
          <Title>Nos voyages</Title>
          {trips.length === 0 && <Empty icon="airplane-outline" text="Aucun voyage pour l'instant." />}
          {trips.map((tr) => (
            <Card key={tr.id} onPress={() => choose(tr.id)} style={tr.id === tripId && { borderColor: t.cyan, borderWidth: 2 }}>
              <Row>
                <Ionicons name="location" size={22} color={t.cyan} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: t.text }}>{tr.name}</Text>
                  <Body muted>
                    {tr.city?.name} · {tr.startDate && formatShort(tr.startDate)} → {tr.endDate && formatShort(tr.endDate)}
                  </Body>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.muted} />
              </Row>
            </Card>
          ))}
          {!trips.some((x) => x.city?.countryCode === 'GB' && x.startDate === '2026-12-27') && (
            <Button title="Créer « Noël à Londres » (27–30 déc. 2026)" icon="gift" variant="accent" onPress={london} loading={busy} />
          )}
          <Button title="Nouveau voyage" icon="add" onPress={() => setCreating(true)} />
        </>
      )}

      {creating && (
        <>
          <Title>Nouveau voyage</Title>
          <Subtitle>1. Destination</Subtitle>
          {city ? (
            <Card>
              <Row>
                <Ionicons name="checkmark-circle" size={20} color={t.success} />
                <Body style={{ marginLeft: 8, flex: 1 }}>{city.name}, {city.country} ({city.currency})</Body>
                <Button title="Changer" small variant="ghost" onPress={() => setCity(null)} />
              </Row>
            </Card>
          ) : (
            <>
              <Row>
                <View style={{ flex: 1 }}>
                  <Input placeholder="Ex. Rome, Lisbonne, Annecy…" value={cityQuery} onChangeText={setCityQuery} onSubmitEditing={async () => setCities(await searchCities(cityQuery))} returnKeyType="search" />
                </View>
                <Button icon="search" small style={{ marginLeft: 8, marginBottom: 12 }} onPress={async () => setCities(await searchCities(cityQuery))} />
              </Row>
              {cities.map((c, i) => (
                <Card key={i} onPress={() => { setCity(c); setCities([]); }}>
                  <Body style={{ fontWeight: '700' }}>{c.name}</Body>
                  <Body muted numberOfLines={1}>{c.label}</Body>
                </Card>
              ))}
            </>
          )}
          <Subtitle>2. Dates et nom</Subtitle>
          <Row>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Input label="Arrivée" placeholder="JJ/MM/AAAA" value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Départ" placeholder="JJ/MM/AAAA" value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" />
            </View>
          </Row>
          <Input label="Nom du voyage (facultatif)" value={name} onChangeText={setName} />
          <Subtitle>3. Hébergement (facultatif)</Subtitle>
          {lodging ? (
            <Card>
              <Row>
                <Ionicons name="bed" size={20} color={t.cyan} />
                <Body style={{ marginLeft: 8, flex: 1 }} numberOfLines={2}>{lodging.name}</Body>
                <Button title="Changer" small variant="ghost" onPress={() => setLodging(null)} />
              </Row>
            </Card>
          ) : (
            <>
              <Row>
                <View style={{ flex: 1 }}>
                  <Input placeholder="Nom ou adresse de l'hôtel" value={lodgingQuery} onChangeText={setLodgingQuery} />
                </View>
                <Button icon="search" small style={{ marginLeft: 8, marginBottom: 12 }} onPress={async () => setLodgings(await searchAddress(lodgingQuery, city))} />
              </Row>
              {lodgings.map((l, i) => (
                <Card key={i} onPress={() => { setLodging(l); setLodgings([]); }}>
                  <Body style={{ fontWeight: '700' }}>{l.name}</Body>
                  <Body muted numberOfLines={2}>{l.address}</Body>
                </Card>
              ))}
            </>
          )}
          <Button title="Créer le voyage" icon="checkmark" onPress={save} loading={busy} />
          <Button title="Annuler" variant="ghost" onPress={() => setCreating(false)} />
        </>
      )}
    </Screen>
  );
}
