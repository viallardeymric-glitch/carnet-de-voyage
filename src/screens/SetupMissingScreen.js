import React from 'react';
import { Screen, Title, Body, Card, SafetyBox } from '../components/ui';

export default function SetupMissingScreen() {
  return (
    <Screen style={{ paddingTop: 80 }}>
      <Title>Encore une étape ✈️</Title>
      <Card>
        <Body>
          L'application n'est pas encore reliée à votre projet Firebase. Ouvrez le fichier{' '}
          <Body style={{ fontWeight: '700' }}>src/config/firebase.js</Body> et collez-y votre configuration
          (étape 2 du guide d'installation), puis enregistrez : l'app se rechargera toute seule.
        </Body>
      </Card>
      <SafetyBox title="Pourquoi Firebase ?">
        <Body>Firebase garde votre planning, vos dépenses et vos positions synchronisés entre vos deux iPhone, de façon privée.</Body>
      </SafetyBox>
    </Screen>
  );
}
