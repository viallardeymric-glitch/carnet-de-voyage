// Session Firebase + profil du téléphone (Eymric « E » ou Marie « M »).
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { MEMBERS } from '../config/settings';

const AuthContext = createContext(null);
const PROFILE_KEY = 'profile:memberId';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = chargement
  const [memberId, setMemberIdState] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((v) => {
      setMemberIdState(v);
      setProfileLoaded(true);
    });
    return onAuthStateChanged(auth, (u) => setUser(u || null));
  }, []);

  const setMemberId = async (id) => {
    setMemberIdState(id);
    if (id) await AsyncStorage.setItem(PROFILE_KEY, id);
    else await AsyncStorage.removeItem(PROFILE_KEY);
  };

  // Si l'email correspond à un membre connu, on choisit le profil automatiquement.
  useEffect(() => {
    if (!user || memberId || !profileLoaded) return;
    const match = Object.values(MEMBERS).find(
      (m) => m.email.toLowerCase() === (user.email || '').toLowerCase()
    );
    if (match) setMemberId(match.id);
  }, [user, memberId, profileLoaded]);

  const login = (email, password) => signInWithEmailAndPassword(auth, email.trim(), password);
  const logout = async () => {
    await setMemberId(null);
    await signOut(auth);
  };

  const value = {
    user,
    loading: user === undefined || !profileLoaded,
    memberId,
    member: memberId ? MEMBERS[memberId] : null,
    setMemberId,
    login,
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
