// Coffre-fort : billets, QR codes, confirmations. Face ID à chaque ouverture.
// Les fichiers restent sur ce téléphone (consultables sans réseau).
import React, { useCallback, useState } from 'react';
import { View, Text, Image, Modal, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { askBiometrics, useLock } from '../context/LockContext';
import { listDocs, addFile, addBooking, removeDoc, previewFile } from '../services/vault';
import { parseBooking, KIND_LABELS } from '../services/bookingParser';
import PinPad from '../components/PinPad';
import { Screen, Title, Subtitle, Body, Card, Button, Chip, Row, Input, Empty, SafetyBox } from '../components/ui';
import { useTheme } from '../theme';

const KINDS = ['vol', 'train', 'hebergement', 'activite', 'autre'];

export default function VaultScreen() {
  const t = useTheme();
  const { checkPin } = useLock();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [docs, setDocs] = useState([]);
  const [viewer, setViewer] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [raw, setRaw] = useState('');
  const [parsed, setParsed] = useState(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('vol');

  const refresh = async () => setDocs(await listDocs());

  const unlock = async () => {
    const ok = await askBiometrics('Ouvrir le coffre-fort');
    if (ok) {
      setOpen(true);
      refresh();
    }
  };

  // Verrouillage à chaque sortie de l'onglet, Face ID à chaque entrée.
  useFocusEffect(
    useCallback(() => {
      unlock();
      return () => {
        setOpen(false);
        setPin('');
        setViewer(null);
      };
    }, [])
  );

  const tryPin = async (v) => {
    setPin(v);
    if (v.length >= 4) {
      // On essaie à 4 puis 6 chiffres selon la longueur choisie.
      if (await checkPin(v)) {
        setOpen(true);
        setPin('');
        refresh();
      } else if (v.length === 6) setPin('');
    }
  };

  const importPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled) return;
    const a = res.assets[0];
    await addFile({ uri: a.uri, name: a.fileName || 'photo.jpg', mimeType: a.mimeType, title: title || 'Billet / QR code', kind });
    setTitle('');
    refresh();
  };

  const importFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const a = res.assets[0];
    await addFile({ uri: a.uri, name: a.name, mimeType: a.mimeType, title: title || a.name, kind });
    setTitle('');
    refresh();
  };

  const saveBooking = async () => {
    await addBooking({ ...parsed, title: title || KIND_LABELS[parsed.kind]?.label, raw, kind: parsed.kind });
    setParsing(false);
    setRaw('');
    setParsed(null);
    setTitle('');
    refresh();
  };

  const show = (d) => {
    if (d.isPdf) previewFile(d.file).catch((e) => Alert.alert('Aperçu impossible', e.message));
    else setViewer(d);
  };

  if (!open) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', paddingTop: 40 }}>
        <Ionicons name="lock-closed" size={42} color={t.cyan} />
        <Title style={{ marginTop: 8 }}>Coffre-fort verrouillé</Title>
        <Button title="Ouvrir avec Face ID" icon="scan" onPress={unlock} />
        <Body muted style={{ marginTop: 8 }}>ou saisissez votre code</Body>
        <PinPad value={pin} length={6} onChange={tryPin} />
      </View>
    );
  }

  const grouped = KINDS.concat('reservation').map((k) => [k, docs.filter((d) => (d.kind || 'autre') === k)]).filter(([, l]) => l.length);

  return (
    <Screen>
      <SafetyBox title="Sécurité des documents">
        <Body>
          Vos fichiers restent uniquement sur ce téléphone, dans l'espace privé de l'app, chiffré par iOS. Rien n'est envoyé sur Internet.
          Pensez à importer les billets sur les deux téléphones.
        </Body>
      </SafetyBox>

      <Subtitle>Ajouter</Subtitle>
      <Card>
        <Input placeholder="Titre (ex. Vol aller EZY8541)" value={title} onChangeText={setTitle} />
        <Row style={{ flexWrap: 'wrap', marginBottom: 6 }}>
          {KINDS.map((k) => (
            <View key={k} style={{ marginBottom: 6 }}>
              <Chip label={KIND_LABELS[k].label} icon={KIND_LABELS[k].icon} active={kind === k} onPress={() => setKind(k)} />
            </View>
          ))}
        </Row>
        <Row>
          <Button title="Photo / QR" icon="image" small onPress={importPhoto} style={{ flex: 1, marginRight: 4 }} />
          <Button title="PDF" icon="document" small onPress={importFile} style={{ flex: 1, marginHorizontal: 4 }} />
          <Button title="Analyser" icon="scan" small variant="accent" onPress={() => setParsing(true)} style={{ flex: 1, marginLeft: 4 }} />
        </Row>
      </Card>

      {parsing && (
        <Card>
          <Body style={{ fontWeight: '700', marginBottom: 6 }}>Collez le texte de votre email de confirmation</Body>
          <Input value={raw} onChangeText={setRaw} multiline style={{ minHeight: 110, textAlignVertical: 'top' }} placeholder="Votre référence de réservation : …" />
          <Button title="Analyser" icon="sparkles" onPress={() => setParsed(parseBooking(raw))} disabled={!raw} />
          {parsed && (
            <View style={{ marginTop: 8 }}>
              <Field label="Type" value={KIND_LABELS[parsed.kind]?.label} t={t} />
              <Field label="Référence" value={parsed.reference} t={t} />
              <Field label="Vols" value={parsed.flights.join(', ')} t={t} />
              <Field label="Dates" value={parsed.dates.join(', ')} t={t} />
              <Field label="Heures" value={parsed.times.join(', ')} t={t} />
              <Field label="Montant" value={parsed.price} t={t} />
              <Button title="Enregistrer dans le coffre" icon="save" variant="accent" onPress={saveBooking} />
            </View>
          )}
          <Button title="Fermer" variant="ghost" small onPress={() => { setParsing(false); setParsed(null); }} />
        </Card>
      )}

      {docs.length === 0 && <Empty icon="folder-open-outline" text="Aucun document pour l'instant." />}
      {grouped.map(([k, list]) => (
        <View key={k}>
          <Subtitle>{KIND_LABELS[k].label}</Subtitle>
          {list.map((d) => (
            <Card key={d.id} onPress={d.file ? () => show(d) : undefined}>
              <Row>
                <Ionicons name={d.isPdf ? 'document-text' : d.isImage ? 'qr-code' : KIND_LABELS[d.kind]?.icon || 'document'} size={24} color={t.cyan} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: t.text, fontWeight: '700' }}>{d.title}</Text>
                  {d.reference ? <Body muted>Réf. {d.reference}</Body> : null}
                  {d.flights?.length ? <Body muted>{d.flights.join(' · ')}</Body> : null}
                  {d.dates?.length ? <Body muted>{d.dates.join(' → ')} {d.times?.length ? `· ${d.times.join(', ')}` : ''}</Body> : null}
                </View>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert('Supprimer ce document ?', d.title, [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Supprimer', style: 'destructive', onPress: async () => { await removeDoc(d.id); refresh(); } },
                    ])
                  }
                >
                  <Ionicons name="trash-outline" size={20} color={t.muted} />
                </TouchableOpacity>
              </Row>
            </Card>
          ))}
        </View>
      ))}

      <Modal visible={!!viewer} animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            {viewer && <Image source={{ uri: viewer.file }} style={{ width: '100%', height: 600 }} resizeMode="contain" />}
          </ScrollView>
          <Text style={{ textAlign: 'center', color: '#555', marginBottom: 8 }}>Astuce : montez la luminosité pour scanner le QR code.</Text>
          <Button title="Fermer" icon="close" onPress={() => setViewer(null)} style={{ margin: 20 }} />
        </View>
      </Modal>
    </Screen>
  );
}

function Field({ label, value, t }) {
  if (!value) return null;
  return (
    <Row style={{ paddingVertical: 3 }}>
      <Text style={{ color: t.muted, width: 90 }}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{value}</Text>
    </Row>
  );
}
