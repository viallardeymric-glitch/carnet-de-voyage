// Journal de bord : une note et une photo par moment fort, partagés entre les deux téléphones.
// Les photos sont réduites (~100 Ko) et stockées dans Firestore (pas besoin de Firebase Storage payant).
import React, { useState } from 'react';
import { View, Text, Image, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { tripDays, formatDay, toISO } from '../services/dates';
import { MEMBERS } from '../config/settings';
import { Screen, Subtitle, Card, Row, Body, Input, Button, Empty, MemberBadge } from '../components/ui';
import { useTheme } from '../theme';

async function compress(uri) {
  const ctx = ImageManipulator.manipulate(uri).resize({ width: 900 });
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: 0.55, format: SaveFormat.JPEG, base64: true });
  return out.base64;
}

export default function JournalScreen() {
  const t = useTheme();
  const { trip, path } = useTrip();
  const { memberId } = useAuth();
  const { items } = useCollection(path('journal'), (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (camera) => {
    const opts = { mediaTypes: ['images'], quality: 0.8 };
    if (camera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled) setPhoto(res.assets[0].uri);
  };

  const save = async () => {
    if (!text.trim() && !photo) return;
    setBusy(true);
    try {
      const b64 = photo ? await compress(photo) : null;
      await addDoc(collection(db, path('journal')), {
        text: text.trim(),
        photo: b64,
        day: toISO(new Date()),
        author: memberId,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
      });
      setText('');
      setPhoto(null);
    } catch (e) {
      Alert.alert('Oups', e.message);
    }
    setBusy(false);
  };

  const days = tripDays(trip);
  const groups = [...new Set(items.map((i) => i.day))];

  return (
    <Screen>
      <Card>
        <Input multiline style={{ minHeight: 80, textAlignVertical: 'top' }} value={text} onChangeText={setText} placeholder="Le moment fort de la journée…" />
        {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: 180, borderRadius: 10, marginBottom: 8 }} />}
        <Row>
          <Button icon="camera" small variant="ghost" onPress={() => pick(true)} style={{ marginRight: 6 }} />
          <Button icon="images" small variant="ghost" onPress={() => pick(false)} style={{ marginRight: 6 }} />
          <Button title="Épingler" icon="pin" onPress={save} loading={busy} style={{ flex: 1 }} />
        </Row>
      </Card>
      {items.length === 0 && <Empty icon="book-outline" text="Aucun souvenir pour l'instant. Le soir, épinglez une photo et une phrase !" />}
      {groups.map((g) => {
        const d = days.find((x) => x.iso === g);
        return (
          <View key={g}>
            <Subtitle>{d ? `Jour ${d.index} · ` : ''}{g ? formatDay(g) : ''}</Subtitle>
            {items.filter((i) => i.day === g).map((i) => (
              <Card key={i.id}>
                {i.photo ? <Image source={{ uri: `data:image/jpeg;base64,${i.photo}` }} style={{ width: '100%', height: 220, borderRadius: 10, marginBottom: 8 }} /> : null}
                {i.text ? <Body>{i.text}</Body> : null}
                <Row style={{ marginTop: 8, justifyContent: 'space-between' }}>
                  <Row>
                    {MEMBERS[i.author] && <MemberBadge member={MEMBERS[i.author]} size={20} />}
                    <Text style={{ color: t.muted, fontSize: 12, marginLeft: 6 }}>
                      {i.createdAtMs ? new Date(i.createdAtMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </Row>
                  {i.author === memberId && (
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert('Supprimer ce souvenir ?', '', [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => deleteDoc(doc(db, path('journal'), i.id)) },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={16} color={t.muted} />
                    </TouchableOpacity>
                  )}
                </Row>
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
