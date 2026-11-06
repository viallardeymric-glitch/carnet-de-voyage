// Voyage actif (choisi sur chaque téléphone) + raccourcis vers ses collections.
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDocument } from '../hooks/useCollection';

const TripContext = createContext(null);
const KEY = 'trip:activeId';

export function TripProvider({ children }) {
  const [tripId, setTripIdState] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const trip = useDocument(tripId ? `trips/${tripId}` : null);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      setTripIdState(v);
      setLoaded(true);
    });
  }, []);

  const setTripId = async (id) => {
    setTripIdState(id);
    if (id) await AsyncStorage.setItem(KEY, id);
    else await AsyncStorage.removeItem(KEY);
  };

  const path = (sub) => (tripId ? `trips/${tripId}/${sub}` : null);

  return (
    <TripContext.Provider value={{ tripId, trip, setTripId, loaded, path }}>
      {children}
    </TripContext.Provider>
  );
}

export const useTrip = () => useContext(TripContext);
