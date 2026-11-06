// Petits composants d'interface réutilisés partout (charte marine / cyan).
import React from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export function Screen({ children, scroll = true, style }) {
  const t = useTheme();
  const Comp = scroll ? ScrollView : View;
  return (
    <Comp
      style={[{ flex: 1, backgroundColor: t.bg }, !scroll && style]}
      contentContainerStyle={scroll ? [{ padding: 16, paddingBottom: 40 }, style] : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </Comp>
  );
}

export function Card({ children, style, onPress }) {
  const t = useTheme();
  const Comp = onPress ? TouchableOpacity : View;
  return (
    <Comp
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}
    >
      {children}
    </Comp>
  );
}

export function Title({ children, style }) {
  const t = useTheme();
  return <Text style={[styles.title, { color: t.dark ? t.text : t.navy }, style]}>{children}</Text>;
}

export function Subtitle({ children, style }) {
  const t = useTheme();
  return <Text style={[styles.subtitle, { color: t.accent }, style]}>{children}</Text>;
}

export function Body({ children, muted, style, ...rest }) {
  const t = useTheme();
  return (
    <Text style={[{ color: muted ? t.muted : t.text, fontSize: 15, lineHeight: 21 }, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Button({ title, onPress, icon, variant = 'primary', loading, disabled, style, small }) {
  const t = useTheme();
  const bg =
    variant === 'primary' ? t.navy : variant === 'accent' ? t.cyan : variant === 'danger' ? t.danger : 'transparent';
  const fg = variant === 'ghost' ? (t.dark ? t.text : t.navy) : '#FFFFFF';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: t.border },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} style={{ marginRight: title ? 8 : 0 }} /> : null}
          {title ? <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

export function Input({ label, style, ...props }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {label ? <Text style={[styles.label, { color: t.muted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.muted}
        style={[styles.input, { backgroundColor: t.card, color: t.text, borderColor: t.border }, style]}
        {...props}
      />
    </View>
  );
}

export function Chip({ label, icon, active, onPress, color }) {
  const t = useTheme();
  const c = color || t.cyan;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? c : t.border, backgroundColor: active ? c : t.card },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? '#fff' : t.text} style={{ marginRight: 4 }} /> : null}
      <Text style={{ color: active ? '#fff' : t.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

// Encadré « Points Sécurité & Santé »
export function SafetyBox({ title = 'Points Sécurité & Santé', children }) {
  const t = useTheme();
  return (
    <View style={[styles.safety, { borderLeftColor: t.cyan, backgroundColor: t.dark ? '#0F2A3D' : '#E6F6FC' }]}>
      <Row style={{ marginBottom: 6 }}>
        <Ionicons name="medkit" size={16} color={t.cyan} />
        <Text style={{ marginLeft: 6, fontWeight: '700', color: t.dark ? t.text : t.navy }}>{title}</Text>
      </Row>
      {children}
    </View>
  );
}

export function Empty({ icon = 'sparkles-outline', text }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: 24 }}>
      <Ionicons name={icon} size={36} color={t.muted} />
      <Text style={{ color: t.muted, marginTop: 8, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function MemberBadge({ member, size = 28 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: member.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.45 }}>{member.id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 8 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, marginVertical: 4 },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 13, marginBottom: 4, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  safety: { borderLeftWidth: 4, borderRadius: 10, padding: 12, marginBottom: 12 },
});
