// Budget partagé : dépenses à deux, solde « qui doit combien à qui », convertisseur.
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { getRates, convert, formatMoney } from '../services/currency';
import { toISO, formatDay } from '../services/dates';
import { MEMBERS } from '../config/settings';
import { Screen, Subtitle, Body, Card, Button, Chip, Row, Input, Empty, MemberBadge } from '../components/ui';
import { useTheme } from '../theme';

const CATS = [
  { id: 'repas', label: 'Repas', icon: 'restaurant' },
  { id: 'transport', label: 'Transport', icon: 'bus' },
  { id: 'activite', label: 'Activités', icon: 'ticket' },
  { id: 'logement', label: 'Logement', icon: 'bed' },
  { id: 'courses', label: 'Courses', icon: 'cart' },
  { id: 'souvenirs', label: 'Souvenirs', icon: 'gift' },
  { id: 'sante', label: 'Santé', icon: 'medkit' },
  { id: 'autre', label: 'Autre', icon: 'ellipsis-horizontal' },
];
const catOf = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

// Solde : chacun a payé X et doit sa part. Positif = on lui doit de l'argent.
export function computeBalance(expenses) {
  const net = { E: 0, M: 0 };
  expenses.forEach((e) => {
    const v = Number(e.amountEur) || 0;
    net[e.paidBy] += v;
    if (e.forWhom === 'both') {
      net.E -= v / 2;
      net.M -= v / 2;
    } else net[e.forWhom] -= v;
  });
  return net;
}

export default function BudgetScreen() {
  const t = useTheme();
  const { trip, path } = useTrip();
  const { memberId } = useAuth();
  const { items: expenses } = useCollection(path('expenses'), (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAtMs || 0) - (a.createdAtMs || 0));
  const local = trip?.city?.currency || 'EUR';
  const [rates, setRates] = useState({ rates: { EUR: 1 } });
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(local);
  const [label, setLabel] = useState('');
  const [paidBy, setPaidBy] = useState(memberId);
  const [forWhom, setForWhom] = useState('both');
  const [cat, setCat] = useState('repas');
  const [convAmount, setConvAmount] = useState('10');
  const [convDir, setConvDir] = useState('toEur');

  useEffect(() => {
    getRates().then(setRates);
  }, []);
  useEffect(() => setCurrency(local), [local]);
  useEffect(() => setPaidBy(memberId), [memberId]);

  const add = async () => {
    const value = Number(String(amount).replace(',', '.'));
    if (!value) return;
    const eur = convert(value, currency, 'EUR', rates.rates);
    if (eur == null) {
      Alert.alert('Taux indisponible', 'Connectez-vous une fois à Internet pour récupérer les taux de change.');
      return;
    }
    await addDoc(collection(db, path('expenses')), {
      label: label || catOf(cat).label,
      amount: value,
      currency,
      amountEur: Math.round(eur * 100) / 100,
      paidBy,
      forWhom,
      category: cat,
      date: toISO(new Date()),
      createdBy: memberId,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    });
    setAmount('');
    setLabel('');
    setAdding(false);
  };

  const net = computeBalance(expenses);
  const total = expenses.reduce((s, e) => s + (Number(e.amountEur) || 0), 0);
  const debtor = net.E < -0.005 ? 'E' : net.M < -0.005 ? 'M' : null;
  const byCat = CATS.map((c) => ({ ...c, sum: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + (Number(e.amountEur) || 0), 0) })).filter((c) => c.sum > 0);

  const convValue = Number(String(convAmount).replace(',', '.')) || 0;
  const converted = convDir === 'toEur' ? convert(convValue, local, 'EUR', rates.rates) : convert(convValue, 'EUR', local, rates.rates);

  return (
    <Screen>
      <Card style={{ backgroundColor: t.navy, borderColor: t.navy }}>
        <Text style={{ color: '#9FD8F0', fontWeight: '700', fontSize: 13 }}>TOTAL DÉPENSÉ</Text>
        <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>{formatMoney(total)}</Text>
        <Text style={{ color: '#fff', marginTop: 6 }}>
          {debtor
            ? `${MEMBERS[debtor].name} doit ${formatMoney(-net[debtor])} à ${MEMBERS[debtor === 'E' ? 'M' : 'E'].name}`
            : 'Vous êtes quittes 🎉'}
        </Text>
      </Card>

      {local !== 'EUR' && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Subtitle style={{ marginTop: 0 }}>Convertisseur</Subtitle>
            <Body muted style={{ fontSize: 12 }}>
              1 € = {rates.rates[local]?.toFixed(4) || '?'} {local}
              {rates.offline ? ' (hors ligne)' : ''}
            </Body>
          </Row>
          <Row>
            <View style={{ flex: 1 }}>
              <Input value={convAmount} onChangeText={setConvAmount} keyboardType="decimal-pad" />
            </View>
            <TouchableOpacity onPress={() => setConvDir(convDir === 'toEur' ? 'fromEur' : 'toEur')} style={{ paddingHorizontal: 10, marginBottom: 12 }}>
              <Ionicons name="swap-horizontal" size={24} color={t.cyan} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 12 }}>
              {converted != null ? formatMoney(converted, convDir === 'toEur' ? 'EUR' : local) : '–'}
            </Text>
          </Row>
          <Body muted style={{ fontSize: 12 }}>{convDir === 'toEur' ? `${local} → EUR` : `EUR → ${local}`}</Body>
        </Card>
      )}

      {adding ? (
        <Card>
          <Row>
            <View style={{ flex: 1 }}>
              <Input placeholder="Montant" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus />
            </View>
            <View style={{ marginLeft: 8, marginBottom: 12, flexDirection: 'row' }}>
              {[...new Set([local, 'EUR'])].map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>
          </Row>
          <Input placeholder="Libellé (facultatif)" value={label} onChangeText={setLabel} />
          <Row style={{ flexWrap: 'wrap' }}>
            {CATS.map((c) => (
              <View key={c.id} style={{ marginBottom: 6 }}>
                <Chip label={c.label} icon={c.icon} active={cat === c.id} onPress={() => setCat(c.id)} />
              </View>
            ))}
          </Row>
          <Body muted style={{ marginTop: 6 }}>Payé par</Body>
          <Row style={{ marginVertical: 6 }}>
            {Object.values(MEMBERS).map((m) => (
              <Chip key={m.id} label={m.name} active={paidBy === m.id} color={m.color} onPress={() => setPaidBy(m.id)} />
            ))}
          </Row>
          <Body muted>Pour</Body>
          <Row style={{ marginVertical: 6 }}>
            <Chip label="Commun (50/50)" active={forWhom === 'both'} onPress={() => setForWhom('both')} />
            {Object.values(MEMBERS).map((m) => (
              <Chip key={m.id} label={m.name} active={forWhom === m.id} color={m.color} onPress={() => setForWhom(m.id)} />
            ))}
          </Row>
          <Row>
            <Button title="Enregistrer" icon="checkmark" onPress={add} style={{ flex: 1, marginRight: 6 }} />
            <Button title="Annuler" variant="ghost" onPress={() => setAdding(false)} style={{ flex: 1, marginLeft: 6 }} />
          </Row>
        </Card>
      ) : (
        <Button title="Ajouter une dépense" icon="add" variant="accent" onPress={() => setAdding(true)} />
      )}

      {byCat.length > 0 && (
        <>
          <Subtitle>Par catégorie</Subtitle>
          <Card>
            {byCat.map((c) => (
              <View key={c.id} style={{ marginBottom: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row>
                    <Ionicons name={c.icon} size={16} color={t.cyan} />
                    <Text style={{ marginLeft: 6, color: t.text }}>{c.label}</Text>
                  </Row>
                  <Text style={{ color: t.text, fontWeight: '700' }}>{formatMoney(c.sum)}</Text>
                </Row>
                <View style={{ height: 6, backgroundColor: t.border, borderRadius: 3, marginTop: 4 }}>
                  <View style={{ width: `${(c.sum / total) * 100}%`, height: 6, backgroundColor: t.cyan, borderRadius: 3 }} />
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      <Subtitle>Dépenses</Subtitle>
      {expenses.length === 0 && <Empty icon="wallet-outline" text="Aucune dépense enregistrée." />}
      {expenses.map((e) => (
        <Card key={e.id} style={{ paddingVertical: 10 }}>
          <Row>
            <Ionicons name={catOf(e.category).icon} size={20} color={t.cyan} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{e.label}</Text>
              <Text style={{ color: t.muted, fontSize: 12 }}>
                {e.date ? formatDay(e.date) : ''} · {e.forWhom === 'both' ? 'commun' : `pour ${MEMBERS[e.forWhom]?.name}`}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{formatMoney(e.amount, e.currency)}</Text>
              {e.currency !== 'EUR' && <Text style={{ color: t.muted, fontSize: 12 }}>{formatMoney(e.amountEur)}</Text>}
            </View>
            {MEMBERS[e.paidBy] && <MemberBadge member={MEMBERS[e.paidBy]} size={24} />}
            <TouchableOpacity
              style={{ marginLeft: 8 }}
              onPress={() =>
                Alert.alert('Supprimer cette dépense ?', e.label, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteDoc(doc(db, path('expenses'), e.id)) },
                ])
              }
            >
              <Ionicons name="trash-outline" size={18} color={t.muted} />
            </TouchableOpacity>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
