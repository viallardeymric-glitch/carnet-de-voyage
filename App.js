// Point d'entrée : fournisseurs (connexion, verrou, voyage) + navigation.
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LockProvider, useLock } from './src/context/LockContext';
import { TripProvider, useTrip } from './src/context/TripContext';
import { useTheme } from './src/theme';
import { isFirebaseConfigured } from './src/config/firebase';

import SetupMissingScreen from './src/screens/SetupMissingScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import PinSetupScreen from './src/screens/PinSetupScreen';
import LockScreen from './src/screens/LockScreen';
import TripsScreen from './src/screens/TripsScreen';
import MapScreen from './src/screens/MapScreen';
import PlaceDetailScreen from './src/screens/PlaceDetailScreen';
import PlannerScreen from './src/screens/PlannerScreen';
import VaultScreen from './src/screens/VaultScreen';
import BudgetScreen from './src/screens/BudgetScreen';
import MoreScreen from './src/screens/MoreScreen';
import ChecklistScreen from './src/screens/ChecklistScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import JournalScreen from './src/screens/JournalScreen';
import AssistantScreen from './src/screens/AssistantScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Carte: 'map',
  Planning: 'calendar',
  Coffre: 'lock-closed',
  Budget: 'wallet',
  Plus: 'grid',
};

function Tabs() {
  const t = useTheme();
  const { trip } = useTrip();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: t.header },
        headerTintColor: t.headerText,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: t.cyan,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Carte" component={MapScreen} options={{ title: trip?.city?.name || 'Carte' }} />
      <Tab.Screen name="Planning" component={PlannerScreen} />
      <Tab.Screen name="Coffre" component={VaultScreen} options={{ title: 'Coffre-fort' }} />
      <Tab.Screen name="Budget" component={BudgetScreen} />
      <Tab.Screen name="Plus" component={MoreScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const t = useTheme();
  const { user, loading, member } = useAuth();
  const lock = useLock();
  const { tripId, loaded } = useTrip();

  if (!isFirebaseConfigured) return <SetupMissingScreen />;
  if (loading || !lock.ready || !loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.cyan} size="large" />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  if (!member) return <ProfileSetupScreen />;
  if (!lock.hasPin) return <PinSetupScreen />;
  if (lock.locked) return <LockScreen />;

  const stackOptions = {
    headerStyle: { backgroundColor: t.header },
    headerTintColor: t.headerText,
    headerTitleStyle: { fontWeight: '800' },
    headerBackTitle: 'Retour',
  };

  return (
    <Stack.Navigator screenOptions={stackOptions}>
      {!tripId ? (
        <Stack.Screen name="Voyages" component={TripsScreen} options={{ title: 'Mes voyages' }} />
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Lieu" component={PlaceDetailScreen} options={{ title: '' }} />
          <Stack.Screen name="Voyages" component={TripsScreen} options={{ title: 'Mes voyages' }} />
          <Stack.Screen name="Checklist" component={ChecklistScreen} options={{ title: 'Check-list' }} />
          <Stack.Screen name="Urgences" component={EmergencyScreen} options={{ title: 'Urgences & santé' }} />
          <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Journal de bord' }} />
          <Stack.Screen name="Assistant" component={AssistantScreen} options={{ title: 'Assistant' }} />
          <Stack.Screen name="Reglages" component={SettingsScreen} options={{ title: 'Réglages' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const t = useTheme();
  const navTheme = t.dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: t.bg, card: t.card, primary: t.cyan } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: t.bg, card: t.card, primary: t.cyan } };
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LockProvider>
          <TripProvider>
            <NavigationContainer theme={navTheme}>
              <StatusBar style="light" />
              <Root />
            </NavigationContainer>
          </TripProvider>
        </LockProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
