import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useLock } from '../context/LockContext';
import { useTheme } from '../theme';
import PinPad from '../components/PinPad';
import { Title, Body, Chip, Row } from '../components/ui';

export default function PinSetupScreen() {
  const t = useTheme();
  const { setPin } = useLock();
  const [length, setLength] = useState(4);
  const [first, setFirst] = useState(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const onChange = (v) => {
    setError('');
    if (v.length < length) {
      setValue(v);
      return;
    }
    if (!first) {
      setFirst(v);
      setValue('');
    } else if (v === first) {
      setPin(v);
    } else {
      setError('Les codes ne correspondent pas, recommencez.');
      setFirst(null);
      setValue('');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: 80, alignItems: 'center' }}>
      <Title>{first ? 'Confirmez le code' : 'Choisissez un code PIN'}</Title>
      <Body muted style={{ textAlign: 'center', paddingHorizontal: 30 }}>
        Il protège l'app et vos billets. Face ID sera proposé en priorité.
      </Body>
      {!first && (
        <Row style={{ marginTop: 14 }}>
          <Chip label="4 chiffres" active={length === 4} onPress={() => { setLength(4); setValue(''); }} />
          <Chip label="6 chiffres" active={length === 6} onPress={() => { setLength(6); setValue(''); }} />
        </Row>
      )}
      {error ? <Text style={{ color: t.danger, marginTop: 10 }}>{error}</Text> : null}
      <PinPad value={value} length={length} onChange={onChange} />
    </View>
  );
}
