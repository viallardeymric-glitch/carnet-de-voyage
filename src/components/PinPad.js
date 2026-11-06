// Clavier de code PIN façon iPhone.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export default function PinPad({ value, length, onChange, onBiometrics, biometricsIcon = 'scan' }) {
  const t = useTheme();
  const press = (d) => value.length < length && onChange(value + d);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', marginVertical: 24 }}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 16, height: 16, borderRadius: 8, marginHorizontal: 9, borderWidth: 2, borderColor: t.cyan,
              backgroundColor: i < value.length ? t.cyan : 'transparent',
            }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 270, justifyContent: 'center' }}>
        {keys.map((k) => {
          if (k === 'bio' && !onBiometrics) return <View key={k} style={{ width: 74, height: 74, margin: 7 }} />;
          return (
            <TouchableOpacity
              key={k}
              onPress={() => (k === 'del' ? onChange(value.slice(0, -1)) : k === 'bio' ? onBiometrics() : press(k))}
              style={{
                width: 74, height: 74, margin: 7, borderRadius: 37, alignItems: 'center', justifyContent: 'center',
                backgroundColor: k === 'del' || k === 'bio' ? 'transparent' : t.card,
              }}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={28} color={t.text} />
              ) : k === 'bio' ? (
                <Ionicons name={biometricsIcon} size={30} color={t.cyan} />
              ) : (
                <Text style={{ fontSize: 28, color: t.text, fontWeight: '500' }}>{k}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
