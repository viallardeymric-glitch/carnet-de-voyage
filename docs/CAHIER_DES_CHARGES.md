# Cahier des charges — « Carnet de Voyage Famille » (app iOS)

> Version reformulée du prompt d'Eymric, prête à être réutilisée telle quelle avec une IA de développement.

## Rôle
Tu es un développeur senior React Native / Expo et un designer UI/UX spécialisé dans les applications de voyage. Tu écris le **code source complet** de l'application (JavaScript, React Native / Expo), modulaire, robuste et commenté en français, versionné sur **GitHub**. Le code doit tourner **directement dans Expo Go sur iPhone** (uniquement des modules inclus dans Expo Go), sans compilation Xcode ni Mac.

## Contexte d'usage
- **Utilisateurs** : un couple, Eymric (marqueur **bleu « E »**) et Marie (marqueur **rose « M »**), voyageant avec leur fille de 5 ans. Marie est enceinte : l'app doit faciliter l'accès aux soins (hôpitaux, pharmacies, numéros d'urgence) et un rythme doux.
- **Premier voyage cible** : Londres, du 27 au 30 décembre 2026 (hôtel Premier Inn London Tower Bridge). L'app doit néanmoins fonctionner pour **n'importe quelle ville du monde**.
- **Code livré sur GitHub** : tout le code source est publié dans un dépôt GitHub d'Eymric, avec un historique propre et des évolutions proposées en pull requests.
- **Installation guidée** : Eymric n'a pas à écrire de code lui-même ; un guide pas à pas explique comment récupérer le code, brancher Firebase et lancer l'app.

## Contraintes techniques
| Sujet | Choix imposé |
|---|---|
| Framework | Expo (dernière version prise en charge par Expo Go), JavaScript |
| Backend | Firebase **gratuit (plan Spark)** : Authentication + Firestore uniquement (pas de Storage, payant) |
| Carte | `react-native-maps` (Apple Plans sur iPhone, sans clé API) |
| Données de lieux | Sources gratuites sans clé : OpenStreetMap (Nominatim, Overpass), Wikipédia (photos, histoire), Open-Meteo (météo), Frankfurter (devises) |
| Sécurité locale | `expo-local-authentication` (Face ID / Touch ID), `expo-secure-store` (PIN haché, clés) |
| Limites Expo Go acceptées | GPS partagé uniquement quand l'app est ouverte (pas d'arrière-plan) ; documents du coffre stockés sur le téléphone uniquement |

## Fonctionnalités

### 1. Authentification & verrouillage
- Connexion Firebase email / mot de passe (un compte chacun, recommandé ; un compte partagé reste possible).
- Choix du profil sur chaque téléphone : « Je suis Eymric (E, bleu) » ou « Je suis Marie (M, rose) ».
- Écran de verrouillage à l'ouverture et au retour après 1 minute en arrière-plan : Face ID / Touch ID, avec code PIN 4 ou 6 chiffres en secours.
- Règles Firestore : seules les deux adresses email autorisées peuvent lire ou écrire.

### 2. Ville, carte interactive & lieux
- Recherche de n'importe quelle ville et création d'un voyage (ville, dates, hébergement).
- Carte fluide (zoom, déplacement, recentrage sur moi / sur l'hôtel).
- Filtres par catégorie avec icônes : Restaurants, Loisirs & enfants, Shopping, Monuments, Musées, Abri pluie (intérieur), Ouvert maintenant, Santé (hôpitaux, pharmacies).
- Fiche lieu : nom, photo et histoire (Wikipédia), horaires, site officiel, téléphone, lien vers les avis en ligne, bouton « J'adore ! ».

### 3. Géolocalisation croisée en temps réel
- Positions d'Eymric et de Marie partagées via Firestore et affichées sur la carte (E bleu, M rose).
- Distance en direct entre les deux, avec l'heure de la dernière mise à jour.
- Interrupteur « Partager ma position » pour couper le partage.

### 4. Y aller
- Bouton « Y aller » sur chaque fiche : à pied, en voiture, en transports en commun.
- Ouverture d'Apple Plans ou Google Maps avec le trajet prêt (les lignes, correspondances et arrêts sont donnés par ces applications).

### 5. Planning & boîte à idées
- Boîte à idées partagée : les envies en vrac, ajoutées depuis la carte ou à la main.
- Planning par jour (Jour 1, Jour 2…) : déplacer une idée vers un jour, réordonner, retirer.
- Bouton « Optimiser le trajet du jour » : ordre géographique le plus court, en partant de l'hébergement.
- Statuts : À faire, Visité, Coup de cœur, visibles sur la carte.
- Synchronisation instantanée entre les deux iPhone.

### 6. Coffre-fort de documents
- Accès protégé par Face ID à chaque ouverture.
- Import de photos (QR codes, cartes d'embarquement) et de PDF, consultables **hors ligne**.
- Fichiers conservés uniquement sur le téléphone (jamais envoyés sur Internet).
- Analyse d'une confirmation de réservation collée en texte : référence, dates, heures, numéros de vol / train.

### 7. Budget partagé & devises
- Saisie rapide d'une dépense (montant, devise, payé par, pour qui, catégorie).
- Conversion automatique en euros et calcul « qui doit combien à qui ».
- Convertisseur de devises en direct.

### 8. Check-list, urgences & journal
- Check-list collaborative synchronisée, pré-remplie pour une famille avec enfant et grossesse.
- Fiche urgences par pays (numéros locaux), hôpitaux avec urgences et pharmacies les plus proches, notes médicales personnelles.
- Journal de bord quotidien avec photo et note, partagé entre les deux téléphones.

### 9. Hors ligne, assistant & design
- Cache local des voyages, lieux, plannings, dépenses et documents ; consultation possible sans réseau.
- Mini-assistant de suggestions : propositions selon l'heure, la météo et les lieux proches (règles locales), avec option IA (Claude) si une clé API est fournie.
- Design épuré, palette marine `#002B49` / cyan `#00A3E0` / fond `#F4F6F8` / texte `#212529`, mode sombre automatique.

## Livrables attendus
1. Architecture technique (arborescence, rôle de chaque module).
2. Schéma des collections Firestore et règles de sécurité prêtes à coller.
3. Code source complet et modulaire de l'application, publié sur GitHub.
4. Guide pas à pas : création du projet Firebase, installation, lancement sur iPhone via Expo Go.

## Critères de réussite
- L'app s'ouvre dans Expo Go sur iPhone et les deux téléphones voient les mêmes données en moins de 2 secondes.
- Face ID protège l'app et, à nouveau, le coffre-fort.
- Le voyage à Londres peut être créé en un clic et utilisé sans connexion pour consulter les billets.
