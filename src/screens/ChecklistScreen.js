// Check-list collaborative : cochée sur un téléphone, cochée sur l'autre.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { MEMBERS } from '../config/settings';
import { Screen, Subtitle, Card, Button, Input, Row, Body, Chip } from '../components/ui';
import { useTheme } from '../theme';

export default function ChecklistScreen() {
  const t = useTheme();
  const { path } = useTrip();
  const { memberId } = useAuth();
  const { items } = useCollection(path('checklist'), (a, b) => (a.order ?? 0) - (b.order ?? 0));
  const [text, setText] = useState('');
  const [section, setSection] = useState('Pratique');
  const [hideDone, setHideDone] = useState(false);

  const sections = [...new Set(items.map((i) => i.section))];
  const done = items.filter((i) => i.done).length;

  const toggle = (i) =>
    updateDoc(doc(db, path('checklist'), i.id), { done: !i.done, doneBy: !i.done ? memberId : null });

  const add = async () => {
    if (!text.trim()) return;
    await addDoc(collection(db, path('checklist')), { label: text.trim(), section, done: false, order: Date.now(), createdBy: memberId });
    setText('');
  };

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>{done} / {items.length} prêts</Text>
          <Chip label="Masquer les faits" active={hideDone} onPress={() => setHideDone(!hideDone)} />
        </Row>
        <View style={{ height: 8, backgroundColor: t.border, borderRadius: 4, marginTop: 10 }}>
          <View style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, height: 8, backgroundColor: t.success, borderRadius: 4 }} />
        </View>
      </Card>

      {sections.map((s) => (
        <View key={s}>
          <Subtitle>{s}</Subtitle>
          {items
            .filter((i) => i.section === s && (!hideDone || !i.done))
            .map((i) => (
              <TouchableOpacity
                key={i.id}
                onPress={() => toggle(i)}
                onLongPress={() =>
                  Alert.alert('Supprimer ?', i.label, [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Supprimer', style: 'destructive', onPress: () => deleteDoc(doc(db, path('checklist'), i.id)) },
                  ])
                }
              >
                <Row style={{ paddingVertical: 9 }}>
                  <Ionicons name={i.done ? 'checkbox' : 'square-outline'} size={22} color={i.done ? t.success : t.muted} />
                  <Text style={{ marginLeft: 10, flex: 1, color: i.done ? t.muted : t.text, textDecorationLine: i.done ? 'line-through' : 'none' }}>
                    {i.label}
                  </Text>
                  {i.done && i.doneBy && MEMBERS[i.doneBy] ? (
                    <Text style={{ color: MEMBERS[i.doneBy].color, fontWeight: '800' }}>{i.doneBy}</Text>
                  ) : null}
                </Row>
              </TouchableOpacity>
            ))}
        </View>
      ))}

      <Subtitle>Ajouter</Subtitle>
      <Row style={{ flexWrap: 'wrap', marginBottom: 6 }}>
        {[...new Set([...sections, 'Pratique'])].map((s) => (
          <View key={s} style={{ marginBottom: 6 }}>
            <Chip label={s} active={section === s} onPress={() => setSection(s)} />
          </View>
        ))}
      </Row>
      <Input placeholder="Ex. Crème hydratante, pyjama licorne…" value={text} onChangeText={setText} onSubmitEditing={add} returnKeyType="done" />
      <Button title="Ajouter" icon="add" onPress={add} />
      <Body muted style={{ fontSize: 12, marginTop: 8 }}>Appui long sur un élément pour le supprimer.</Body>
    </Screen>
  );
}
