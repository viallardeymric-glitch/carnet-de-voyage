// Planning du séjour : boîte à idées partagée + programme jour par jour,
// avec optimisation géographique de l'ordre des visites.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { categoryById, CATEGORIES } from '../data/categories';
import { tripDays, formatDay, todayIndex, formatShort } from '../services/dates';
import { optimizeOrder, routeLength, formatDistance, familyWalkMinutes } from '../services/geo';
import { savePlace, reorder } from '../services/placesStore';
import { searchAddress } from '../services/places';
import { Screen, Title, Subtitle, Body, Card, Button, Chip, Row, Input, Empty, SafetyBox } from '../components/ui';
import { useTheme } from '../theme';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

export default function PlannerScreen({ navigation }) {
  const t = useTheme();
  const { trip, tripId, path } = useTrip();
  const { memberId } = useAuth();
  const { items: places, fromCache } = useCollection(path('places'));
  const days = tripDays(trip);
  const [selected, setSelected] = useState(todayIndex(trip) || 0); // 0 = boîte à idées
  const [adding, setAdding] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [ideaCat, setIdeaCat] = useState('loisirs');
  const [busy, setBusy] = useState(false);

  const ideas = places.filter((p) => !p.day).sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || byOrder(a, b));
  const dayPlaces = (i) => places.filter((p) => p.day === i).sort(byOrder);
  const list = selected === 0 ? ideas : dayPlaces(selected);

  const moveTo = (place) => {
    Alert.alert(place.name, 'Déplacer vers :', [
      ...(place.day ? [{ text: 'Boîte à idées', onPress: () => savePlace(tripId, place, { day: null }) }] : []),
      ...days
        .filter((d) => d.index !== place.day)
        .map((d) => ({ text: `Jour ${d.index} · ${formatDay(d.iso)}`, onPress: () => savePlace(tripId, place, { day: d.index, order: Date.now() }) })),
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const shift = async (index, dir) => {
    const arr = [...list];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    await reorder(tripId, arr);
  };

  const optimize = async () => {
    const start = trip?.lodging ? { lat: trip.lodging.lat, lon: trip.lodging.lon } : null;
    const before = routeLength(list, start);
    const ordered = optimizeOrder(list, start);
    const after = routeLength(ordered, start);
    await reorder(tripId, ordered);
    Alert.alert(
      'Trajet optimisé',
      after < before - 50
        ? `Distance réduite de ${formatDistance(before)} à ${formatDistance(after)}, en partant de l'hôtel.`
        : 'L\'ordre était déjà le plus court.'
    );
  };

  const addIdea = async () => {
    if (!ideaText.trim()) return;
    setBusy(true);
    let geo = null;
    try {
      geo = (await searchAddress(ideaText, trip?.city))[0] || null;
    } catch {
      geo = null;
    }
    await savePlace(
      tripId,
      { name: ideaText.trim(), category: ideaCat, lat: geo?.lat ?? null, lon: geo?.lon ?? null, tags: { street: geo?.address?.split(',').slice(0, 2).join(',') || '' } },
      { day: selected || null },
      memberId
    );
    setIdeaText('');
    setAdding(false);
    setBusy(false);
  };

  if (!trip) return <Screen><Empty text="Chargement du voyage…" /></Screen>;

  const start = trip.lodging ? { lat: trip.lodging.lat, lon: trip.lodging.lon } : null;
  const total = selected ? routeLength(list, start) : 0;

  return (
    <Screen>
      <Title>{trip.name}</Title>
      <Body muted style={{ marginBottom: 8 }}>
        {trip.city?.name} · du {formatShort(trip.startDate)} au {formatShort(trip.endDate)}
        {trip.lodging ? ` · ${trip.lodging.name}` : ''}
      </Body>
      {fromCache && <Body muted style={{ fontSize: 12 }}>Hors ligne : affichage de la dernière copie enregistrée.</Body>}

      <Row style={{ flexWrap: 'wrap', marginVertical: 8 }}>
        <View style={{ marginBottom: 6 }}>
          <Chip label={`Idées (${ideas.length})`} icon="bulb" active={selected === 0} onPress={() => setSelected(0)} color={t.warning} />
        </View>
        {days.map((d) => (
          <View key={d.index} style={{ marginBottom: 6 }}>
            <Chip label={`J${d.index} · ${formatDay(d.iso)}`} active={selected === d.index} onPress={() => setSelected(d.index)} color={t.navy} />
          </View>
        ))}
      </Row>

      {selected === 0 ? (
        <Body muted style={{ marginBottom: 8 }}>
          Notre boîte à idées partagée : ajoutez des envies en vrac, puis touchez le calendrier pour les placer dans un jour.
        </Body>
      ) : (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <Subtitle>{`Jour ${selected} · ${formatDay(days[selected - 1].iso)}`}</Subtitle>
            {list.length > 1 && <Button small icon="git-network" title="Optimiser le trajet" variant="accent" onPress={optimize} />}
          </Row>
          {list.length > 0 && start && (
            <Body muted style={{ marginBottom: 8 }}>
              Boucle depuis l'hôtel : {formatDistance(total)} à vol d'oiseau (≈ {familyWalkMinutes(total)} min de marche au total).
            </Body>
          )}
          {list.length > 0 && (
            <SafetyBox title="Rythme doux">
              <Body>Gardez une pause repos de 14h à 16h (hôtel ou café calme) pour Marie et la petite. Visez 2 à 3 lieux maximum par jour.</Body>
            </SafetyBox>
          )}
        </>
      )}

      {list.length === 0 && <Empty icon={selected ? 'calendar-outline' : 'bulb-outline'} text={selected ? 'Rien de prévu ce jour-là. Ajoutez des lieux depuis la boîte à idées ou la carte.' : 'La boîte à idées est vide.'} />}

      {list.map((p, i) => {
        const cat = categoryById(p.category);
        return (
          <Card key={p.id} style={{ paddingVertical: 10 }}>
            <Row>
              {selected ? (
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.navy, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{i + 1}</Text>
                </View>
              ) : (
                <Ionicons name={cat.icon} size={22} color={cat.color} style={{ marginRight: 10 }} />
              )}
              <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Lieu', { place: p })}>
                <Text style={{ color: t.text, fontWeight: '700', fontSize: 15, textDecorationLine: p.status === 'visited' ? 'line-through' : 'none' }}>
                  {p.favorite ? '❤️ ' : ''}
                  {p.name}
                </Text>
                <Text style={{ color: t.muted, fontSize: 12 }}>
                  {cat.label}
                  {p.status === 'visited' ? ' · Visité' : ''}
                  {p.lat == null ? ' · sans position' : ''}
                </Text>
              </TouchableOpacity>
              {selected ? (
                <>
                  <IconBtn icon="chevron-up" onPress={() => shift(i, -1)} t={t} />
                  <IconBtn icon="chevron-down" onPress={() => shift(i, 1)} t={t} />
                </>
              ) : null}
              <IconBtn icon={p.status === 'visited' ? 'checkmark-circle' : 'ellipse-outline'} color={p.status === 'visited' ? t.success : t.muted} onPress={() => savePlace(tripId, p, { status: p.status === 'visited' ? 'todo' : 'visited' })} t={t} />
              <IconBtn icon="calendar" color={t.cyan} onPress={() => moveTo(p)} t={t} />
            </Row>
          </Card>
        );
      })}

      {adding ? (
        <Card>
          <Input placeholder={'Ex. « Hamleys », « goûter Borough Market »'} value={ideaText} onChangeText={setIdeaText} autoFocus />
          <Row style={{ flexWrap: 'wrap' }}>
            {CATEGORIES.map((c) => (
              <View key={c.id} style={{ marginBottom: 6 }}>
                <Chip label={c.label} icon={c.icon} active={ideaCat === c.id} color={c.color} onPress={() => setIdeaCat(c.id)} />
              </View>
            ))}
          </Row>
          <Body muted style={{ fontSize: 12, marginBottom: 6 }}>L'app cherche automatiquement le lieu pour le placer sur la carte.</Body>
          <Row>
            <Button title="Ajouter" icon="add" onPress={addIdea} loading={busy} style={{ flex: 1, marginRight: 6 }} />
            <Button title="Annuler" variant="ghost" onPress={() => setAdding(false)} style={{ flex: 1, marginLeft: 6 }} />
          </Row>
        </Card>
      ) : (
        <Button title={selected ? `Ajouter au jour ${selected}` : 'Nouvelle idée'} icon="add" onPress={() => setAdding(true)} />
      )}
      {trip.notes ? (
        <Card style={{ marginTop: 12 }}>
          <Row>
            <Ionicons name="information-circle" size={18} color={t.cyan} />
            <Body style={{ marginLeft: 8, flex: 1 }}>{trip.notes}</Body>
          </Row>
        </Card>
      ) : null}
    </Screen>
  );
}

function IconBtn({ icon, onPress, t, color }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 6 }}>
      <Ionicons name={icon} size={22} color={color || t.muted} />
    </TouchableOpacity>
  );
}
