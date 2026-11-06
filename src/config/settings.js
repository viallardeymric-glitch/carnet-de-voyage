// Réglages de la famille. Modifiez les emails pour qu'ils correspondent
// aux comptes créés dans Firebase (et dans firestore.rules).
export const MEMBERS = {
  E: { id: 'E', name: 'Eymric', color: '#1E6FD9', email: 'eymric@exemple.fr' },
  M: { id: 'M', name: 'Marie', color: '#E2508C', email: 'marie@exemple.fr' },
};

export const otherMember = (id) => (id === 'E' ? 'M' : 'E');

// Verrouillage automatique après X secondes en arrière-plan.
export const AUTO_LOCK_SECONDS = 60;

// Vitesse de marche « famille avec enfant de 5 ans » (km/h).
export const FAMILY_WALK_KMH = 3;

// Modèle IA utilisé par l'assistant (optionnel, clé à saisir dans Réglages).
export const CLAUDE_MODEL = 'claude-haiku-5-5';

// Identifiant envoyé aux services OpenStreetMap / Wikipédia (politesse d'usage).
export const USER_AGENT = 'CarnetDeVoyageFamille/1.0 (app personnelle)';
