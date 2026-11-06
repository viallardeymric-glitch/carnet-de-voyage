// Assistant : « que faire maintenant ? » selon l'heure, la météo et ce qui est proche.
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { getWeather } from '../services/weather';
import { localSuggestions, askClaude, getApiKey, momentOfDay } from '../services/assistant';
import { savePlace } from '../services/placesStore';
import { categoryById } from '../data/categories';
import { formatDistance } from '../services/geo';
import { Screen, Subtitle, Card, Row, Body, Input, Button } from '../components/ui';
import { useTheme } from '../theme';

export default function AssistantScreen({ navigation }) {
  const t = useTheme();
  const { trip, tripId, path } = useTrip();
  const { memberId } = useAuth();
  const { items: places } = useCollection(path('places'));
  const [weather, setWeather] = useState(null);
  const [data, setData] = useState(null);
  const [hasKey, setHasKey] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);

  const run = async () => {
    setData(null);
    let pos = trip?.lodging || trip?.city;
    try {
      const l = await Location.getLastKnownPositionAsync();
      if (l) pos = { lat: l.coords.latitude, lon: l.coords.longitude };
    } catch {}
    let w = null;
    try {
      w = await getWeather(pos);
    } catch {}
    setWeather(w);
    setData(await localSuggestions({ position: pos, weather: w, ideas: places }));
  };

  useEffect(() => {
    if (trip) run();
    getApiKey().then((k) => setHasKey(!!k));
  }, [trip?.id]);

  const ask = async () => {
    setThinking(true);
    setAnswer('');
    try {
      const context = {
        ville: trip?.city?.name,
        heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        moment: momentOfDay(),
        meteo: weather,
        hotel: trip?.lodging?.name,
        lieuxProches: data?.places?.slice(0, 5).map((p) => `${p.name} (${formatDistance(p.distance)})`),
        boiteAIdees: places.filter((p) => !p.day).map((p) => p.name).slice(0, 15),
      };
      setAnswer(await askClaude({ question: question || 'Que nous conseilles-tu de faire maintenant ?', context }));
    } catch (e) {
      setAnswer(`⚠️ ${e.message}`);
    }
    setThinking(false);
  };

  return (
    <Screen>
      {weather && (
        <Card style={{ backgroundColor: t.navy, borderColor: t.navy }}>
          <Row>
            <Ionicons name={weather.icon} size={36} color={t.cyan} />
            <View style={{ marginLeft: 12 }}>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{weather.temp}°C · {weather.label}</Text>
              <Text style={{ color: '#CFE8F5' }}>
                Min {weather.min}° / max {weather.max}°{weather.rainChance != null ? ` · pluie ${weather.rainChance}%` : ''}
              </Text>
            </View>
          </Row>
        </Card>
      )}

      {!data && <ActivityIndicator color={t.cyan} style={{ marginTop: 20 }} />}
      {data && (
        <>
          <Card>
            {data.tips.map((tip) => (
              <Row key={tip} style={{ alignItems: 'flex-start', marginBottom: 6 }}>
                <Ionicons name="sparkles" size={16} color={t.cyan} style={{ marginTop: 3 }} />
                <Body style={{ marginLeft: 8, flex: 1 }}>{tip}</Body>
              </Row>
            ))}
          </Card>

          {data.ideasNear.length > 0 && <Subtitle>De notre boîte à idées, tout près</Subtitle>}
          {data.ideasNear.map((p) => (
            <Card key={p.id} onPress={() => navigation.navigate('Lieu', { place: p })}>
              <Row>
                <Ionicons name="bulb" size={20} color={t.warning} />
                <Text style={{ marginLeft: 10, flex: 1, color: t.text, fontWeight: '700' }}>{p.name}</Text>
                <Body muted>≈ {p.walk} min</Body>
              </Row>
            </Card>
          ))}

          <Subtitle>{`Suggestions · ${categoryById(data.category).label}`}</Subtitle>
          {data.places.length === 0 && <Body muted>Rien trouvé à proximité (ou pas de réseau).</Body>}
          {data.places.map((p) => (
            <Card key={p.osmId} onPress={() => navigation.navigate('Lieu', { place: p })}>
              <Row>
                <Ionicons name={categoryById(p.category).icon} size={20} color={categoryById(p.category).color} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>{p.name}</Text>
                  <Body muted style={{ fontSize: 13 }}>{formatDistance(p.distance)} · ≈ {p.walk} min à pied</Body>
                </View>
                <Button icon="add" small variant="ghost" onPress={() => savePlace(tripId, p, {}, memberId)} />
              </Row>
            </Card>
          ))}
          <Button title="Actualiser" icon="refresh" variant="ghost" onPress={run} />
        </>
      )}

      <Subtitle>Demander à l'IA</Subtitle>
      {hasKey ? (
        <Card>
          <Input value={question} onChangeText={setQuestion} placeholder="Ex. Une idée de goûter au chaud près d'ici ?" multiline />
          <Button title="Demander" icon="chatbubble-ellipses" variant="accent" onPress={ask} loading={thinking} />
          {answer ? <Body style={{ marginTop: 10 }}>{answer}</Body> : null}
        </Card>
      ) : (
        <Body muted>
          Optionnel : ajoutez une clé API Claude dans Réglages pour poser des questions libres. Les suggestions ci-dessus fonctionnent sans.
        </Body>
      )}
    </Screen>
  );
}
