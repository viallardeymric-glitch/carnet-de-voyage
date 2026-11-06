// Fiche détaillée d'un lieu : photo, histoire, horaires, avis, « J'adore ! », Y aller.
import React, { useEffect, useState } from 'react';
import { Text, Image, Linking, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { categoryById } from '../data/categories';
import { fetchWikiSummary } from '../services/places';
import { isOpenNow } from '../services/openNow';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../services/geo';
import { MODES, openDirections, reviewsUrl, tripadvisorUrl } from '../services/routing';
import { savePlace, removePlace } from '../services/placesStore';
import { tripDays, formatDay } from '../services/dates';
import { MEMBERS } from '../config/settings';
import { Screen, Title, Subtitle, Body, Card, Button, Chip, Row, Input, SafetyBox } from '../components/ui';
import { useTheme } from '../theme';

export default function PlaceDetailScreen({ route, navigation }) {
  const t = useTheme();
  const { trip, tripId, path } = useTrip();
  const { memberId } = useAuth();
  const { items: saved } = useCollection(path('places'));
  const initial = route.params.place;
  const live = saved.find((s) => (initial.id && s.id === initial.id) || (initial.osmId && s.osmId === initial.osmId));
  const place = live || initial;
  const cat = categoryById(place.category);

  const [wiki, setWiki] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState('walk');
  const [note, setNote] = useState(place.note || '');

  useEffect(() => {
    navigation.setOptions({ title: cat.label });
    fetchWikiSummary(place.tags).then(setWiki);
    Location.getLastKnownPositionAsync().then((l) => l && setMe({ lat: l.coords.latitude, lon: l.coords.longitude }));
  }, []);

  const update = async (patch) => {
    try {
      await savePlace(tripId, place, patch, memberId);
    } catch (e) {
      Alert.alert('Oups', e.message);
    }
  };

  const planOn = () => {
    const days = tripDays(trip);
    Alert.alert('Planifier', 'Ajouter ce lieu au :', [
      { text: 'Boîte à idées', onPress: () => update({ day: null }) },
      ...days.map((d) => ({ text: `Jour ${d.index} · ${formatDay(d.iso)}`, onPress: () => update({ day: d.index, order: Date.now() }) })),
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const open = isOpenNow(place, trip?.city?.countryCode);
  const fromMe = distanceMeters(me, place);
  const fromHotel = distanceMeters(trip?.lodging, place);
  const tags = place.tags || {};

  return (
    <Screen>
      {wiki?.image ? <Image source={{ uri: wiki.image }} style={{ width: '100%', height: 200, borderRadius: 14, marginBottom: 12 }} resizeMode="cover" /> : null}
      <Title>{place.name}</Title>
      <Row style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip label={cat.label} icon={cat.icon} active color={cat.color} />
        {open != null && <Chip label={open ? 'Ouvert' : 'Fermé'} icon="time" active color={open ? t.success : t.danger} />}
        {place.day ? <Chip label={`Jour ${place.day}`} icon="calendar" active color={t.navy} /> : null}
        {place.addedBy && MEMBERS[place.addedBy] ? <Chip label={`Ajouté par ${MEMBERS[place.addedBy].name}`} /> : null}
      </Row>

      {/* Actions principales */}
      <Row style={{ marginBottom: 8 }}>
        <Button
          style={{ flex: 1, marginRight: 6 }}
          variant={place.favorite ? 'danger' : 'ghost'}
          icon={place.favorite ? 'heart' : 'heart-outline'}
          title="J'adore !"
          onPress={() => update({ favorite: !place.favorite })}
        />
        <Button style={{ flex: 1, marginLeft: 6 }} icon="calendar" title={place.id || live ? 'Planifier' : 'Ajouter'} onPress={planOn} />
      </Row>
      {(place.id || live) && (
        <Button
          variant={place.status === 'visited' ? 'accent' : 'ghost'}
          icon={place.status === 'visited' ? 'checkmark-circle' : 'ellipse-outline'}
          title={place.status === 'visited' ? 'Visité ✓' : 'Marquer comme visité'}
          onPress={() => update({ status: place.status === 'visited' ? 'todo' : 'visited' })}
        />
      )}

      {/* Y aller */}
      <Subtitle>Y aller</Subtitle>
      <Card>
        <Row style={{ marginBottom: 10 }}>
          {MODES.map((m) => (
            <Chip key={m.id} label={m.label} icon={m.icon} active={mode === m.id} onPress={() => setMode(m.id)} />
          ))}
        </Row>
        {fromMe != null && (
          <Body muted>
            Depuis ma position : {formatDistance(fromMe)}
            {mode === 'walk' ? ` · ≈ ${familyWalkMinutes(fromMe)} min au rythme de la petite` : ''}
          </Body>
        )}
        {fromHotel != null && <Body muted>Depuis l'hôtel : {formatDistance(fromHotel)}</Body>}
        <Button title="Y aller" icon="navigate" variant="accent" onPress={() => openDirections(place, mode)} style={{ marginTop: 8 }} />
        {mode === 'transit' && (
          <Body muted style={{ fontSize: 13, marginTop: 4 }}>
            Lignes, correspondances et arrêts sont donnés en direct par Plans, Google Maps ou Citymapper.
          </Body>
        )}
      </Card>

      {/* Histoire */}
      {wiki?.text ? (
        <>
          <Subtitle>Histoire</Subtitle>
          <Card>
            <Body>{wiki.text}</Body>
            {wiki.url && (
              <TouchableOpacity onPress={() => Linking.openURL(wiki.url)}>
                <Text style={{ color: t.cyan, marginTop: 8, fontWeight: '600' }}>Lire sur Wikipédia ›</Text>
              </TouchableOpacity>
            )}
          </Card>
        </>
      ) : null}

      {/* Infos pratiques */}
      <Subtitle>Infos pratiques</Subtitle>
      <Card>
        {tags.street ? <Info icon="location" text={tags.street} t={t} /> : null}
        {tags.opening_hours ? <Info icon="time" text={tags.opening_hours} t={t} /> : null}
        {tags.cuisine ? <Info icon="restaurant" text={`Cuisine : ${tags.cuisine.replace(/;/g, ', ')}`} t={t} /> : null}
        {tags.fee === 'no' ? <Info icon="pricetag" text="Entrée gratuite" t={t} /> : null}
        {tags.wheelchair === 'yes' ? <Info icon="accessibility" text="Accessible poussette / fauteuil" t={t} /> : null}
        {tags.website ? <Info icon="globe" text="Site officiel" link={tags.website} t={t} /> : null}
        {tags.phone ? <Info icon="call" text={tags.phone} link={`tel:${tags.phone.replace(/\s/g, '')}`} t={t} /> : null}
        <Info icon="star" text="Avis Google" link={reviewsUrl(place)} t={t} />
        <Info icon="chatbubbles" text="Avis Tripadvisor" link={tripadvisorUrl(place, trip?.city?.name)} t={t} />
      </Card>

      {place.category === 'sante' && (
        <SafetyBox>
          <Body>Pour une urgence, appelez directement les secours (voir l'onglet Urgences). Signalez la grossesse dès l'accueil.</Body>
        </SafetyBox>
      )}

      {(place.id || live) && (
        <>
          <Subtitle>Notre note</Subtitle>
          <Input value={note} onChangeText={setNote} onEndEditing={() => update({ note })} placeholder="Réserver avant, idéal pour la pause goûter…" multiline />
          <Button
            title="Retirer de nos lieux"
            variant="ghost"
            icon="trash-outline"
            onPress={() =>
              Alert.alert('Retirer ce lieu ?', '', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Retirer', style: 'destructive', onPress: async () => { await removePlace(tripId, (live || place).id); navigation.goBack(); } },
              ])
            }
          />
        </>
      )}
    </Screen>
  );
}

function Info({ icon, text, link, t }) {
  const content = (
    <Row style={{ paddingVertical: 6 }}>
      <Ionicons name={icon} size={18} color={t.cyan} />
      <Text style={{ marginLeft: 10, color: link ? t.cyan : t.text, flex: 1, fontWeight: link ? '600' : '400' }}>{text}</Text>
    </Row>
  );
  return link ? <TouchableOpacity onPress={() => Linking.openURL(link)}>{content}</TouchableOpacity> : content;
}
