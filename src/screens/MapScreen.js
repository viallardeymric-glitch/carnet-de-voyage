// Carte interactive : lieux par catégorie, nos lieux enregistrés, hôtel,
// et positions en direct d'Eymric (E bleu) et Marie (M rose).
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../hooks/useCollection';
import { useLiveLocation } from '../hooks/useLiveLocation';
import { CATEGORIES, categoryById } from '../data/categories';
import { fetchPlaces } from '../services/places';
import { isOpenNow } from '../services/openNow';
import { distanceMeters, formatDistance, familyWalkMinutes } from '../services/geo';
import { MEMBERS, otherMember } from '../config/settings';
import { Chip, MemberBadge } from '../components/ui';
import { useTheme } from '../theme';

function minutesAgo(ms) {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  return m <= 0 ? "à l'instant" : `il y a ${m} min`;
}

export default function MapScreen({ navigation }) {
  const t = useTheme();
  const mapRef = useRef(null);
  const { trip, path } = useTrip();
  const { memberId, member } = useAuth();
  const { items: saved } = useCollection(path('places'));
  const { me, others, permission } = useLiveLocation();

  const [category, setCategory] = useState(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [showSaved, setShowSaved] = useState(true);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const center = useRef(null);

  const base = trip?.lodging || trip?.city;
  const initialRegion = base
    ? { latitude: base.lat, longitude: base.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : undefined;

  const search = async (catId) => {
    const c = center.current || (base && { lat: base.lat, lon: base.lon });
    if (!c || !catId) return;
    setLoading(true);
    setError('');
    try {
      setResults(await fetchPlaces(catId, c, catId === 'sante' ? 3000 : 1500));
    } catch {
      setError('Recherche impossible (réseau). Réessayez.');
    }
    setLoading(false);
  };

  const pickCategory = (id) => {
    const next = category === id ? null : id;
    setCategory(next);
    setResults([]);
    if (next) search(next);
  };

  const visibleResults = useMemo(() => {
    const savedIds = new Set(saved.map((s) => s.osmId).filter(Boolean));
    return results
      .filter((r) => !savedIds.has(r.osmId))
      .filter((r) => !openOnly || isOpenNow(r, trip?.city?.countryCode) === true);
  }, [results, saved, openOnly, trip]);

  const visibleSaved = useMemo(
    () => (showSaved ? saved.filter((s) => s.lat != null) : []).filter((s) => !openOnly || isOpenNow(s, trip?.city?.countryCode) !== false),
    [saved, showSaved, openOnly, trip]
  );

  const partner = others.find((o) => o.id === otherMember(memberId));
  const gap = me && partner ? distanceMeters(me, partner) : null;

  const focus = (p) =>
    p && mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lon, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500);

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsCompass
        showsPointsOfInterest={false}
        onRegionChangeComplete={(r) => (center.current = { lat: r.latitude, lon: r.longitude })}
      >
        {trip?.lodging && (
          <Marker coordinate={{ latitude: trip.lodging.lat, longitude: trip.lodging.lon }} title={trip.lodging.name} description="Notre hébergement">
            <View style={[styles.pin, { backgroundColor: t.navy }]}>
              <Ionicons name="bed" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {visibleResults.map((p) => (
          <Marker
            key={p.osmId}
            coordinate={{ latitude: p.lat, longitude: p.lon }}
            pinColor={categoryById(p.category).color}
            title={p.name}
            description="Touchez pour la fiche"
            onCalloutPress={() => navigation.navigate('Lieu', { place: p })}
          />
        ))}

        {visibleSaved.map((p) => {
          const cat = categoryById(p.category);
          const color = p.favorite ? t.pink : p.status === 'visited' ? t.success : cat.color;
          const icon = p.favorite ? 'heart' : p.status === 'visited' ? 'checkmark' : cat.icon;
          return (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.lat, longitude: p.lon }}
              onPress={() => navigation.navigate('Lieu', { place: p })}
              tracksViewChanges={false}
            >
              <View style={[styles.pin, { backgroundColor: color }]}>
                <Ionicons name={icon} size={14} color="#fff" />
                {p.day ? <Text style={styles.dayTag}>J{p.day}</Text> : null}
              </View>
            </Marker>
          );
        })}

        {me && member && (
          <Marker coordinate={{ latitude: me.lat, longitude: me.lon }} anchor={{ x: 0.5, y: 0.5 }} title={`${member.name} (moi)`}>
            <MemberBadge member={member} size={34} />
          </Marker>
        )}
        {others.map((o) => (
          <Marker key={o.id} coordinate={{ latitude: o.lat, longitude: o.lon }} anchor={{ x: 0.5, y: 0.5 }} title={MEMBERS[o.id]?.name} description={minutesAgo(o.updatedAtMs)}>
            {MEMBERS[o.id] && <MemberBadge member={MEMBERS[o.id]} size={34} />}
          </Marker>
        ))}
      </MapView>

      {/* Filtres */}
      <View style={styles.top}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10 }}>
          <Chip label="Nos lieux" icon="star" active={showSaved} onPress={() => setShowSaved(!showSaved)} color={t.navy} />
          <Chip label="Ouvert maintenant" icon="time" active={openOnly} onPress={() => setOpenOnly(!openOnly)} color={t.success} />
          {CATEGORIES.map((c) => (
            <Chip key={c.id} label={c.label} icon={c.icon} active={category === c.id} color={c.color} onPress={() => pickCategory(c.id)} />
          ))}
        </ScrollView>

        {partner && gap != null && (
          <View style={[styles.banner, { backgroundColor: t.card }]}>
            <MemberBadge member={MEMBERS[partner.id]} size={24} />
            <Text style={{ marginLeft: 8, color: t.text, flex: 1 }}>
              {gap < 60 ? (
                <Text style={{ fontWeight: '700' }}>Vous êtes ensemble</Text>
              ) : (
                <>
                  <Text style={{ fontWeight: '700' }}>{MEMBERS[partner.id].name} est à {formatDistance(gap)}</Text>
                  {` · ≈ ${familyWalkMinutes(gap)} min à pied`}
                </>
              )}
              <Text style={{ color: t.muted }}>{`  ${minutesAgo(partner.updatedAtMs)}`}</Text>
            </Text>
          </View>
        )}
        {permission === 'denied' && (
          <View style={[styles.banner, { backgroundColor: t.card }]}>
            <Ionicons name="warning" size={18} color={t.warning} />
            <Text style={{ marginLeft: 8, color: t.text, flex: 1 }}>Position refusée : autorisez-la dans Réglages iPhone › Expo Go.</Text>
          </View>
        )}
        {error ? (
          <View style={[styles.banner, { backgroundColor: t.card }]}>
            <Text style={{ color: t.danger }}>{error}</Text>
          </View>
        ) : null}
      </View>

      {/* Boutons flottants */}
      <View style={styles.fabs}>
        {loading && <ActivityIndicator color={t.cyan} style={{ marginBottom: 10 }} />}
        {category && !loading && (
          <TouchableOpacity style={[styles.fabWide, { backgroundColor: t.navy }]} onPress={() => search(category)}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 6 }}>Chercher ici</Text>
          </TouchableOpacity>
        )}
        {me && <Fab icon="navigate" onPress={() => focus(me)} t={t} />}
        {partner && <Fab icon="heart" onPress={() => focus(partner)} t={t} color={MEMBERS[partner.id].color} />}
        {trip?.lodging && <Fab icon="bed" onPress={() => focus(trip.lodging)} t={t} />}
        <Fab icon="sparkles" onPress={() => navigation.navigate('Assistant')} t={t} color={t.cyan} />
      </View>
    </View>
  );
}

function Fab({ icon, onPress, t, color }) {
  return (
    <TouchableOpacity style={[styles.fab, { backgroundColor: t.card }]} onPress={onPress}>
      <Ionicons name={icon} size={22} color={color || t.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 10, left: 0, right: 0 },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 10, marginTop: 8, padding: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  fabs: { position: 'absolute', right: 12, bottom: 20, alignItems: 'flex-end' },
  fab: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  fabWide: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 40, borderRadius: 20 },
  pin: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff', flexDirection: 'row', paddingHorizontal: 4 },
  dayTag: { color: '#fff', fontSize: 10, fontWeight: '800', marginLeft: 2 },
});
