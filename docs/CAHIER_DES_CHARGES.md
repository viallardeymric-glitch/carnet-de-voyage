# Cahier des charges — « Carnet de Voyage Famille » (app iOS)

> Version reformulée du prompt d'Eymric, prête à être réutilisée telle quelle avec une IA de développement.

## Rôle
Tu es un développeur senior web et un designer UI/UX spécialisé dans les applications de voyage. Tu écris le **code source complet** d'une **web-app installable (PWA)**, modulaire, robuste et commentée en français, publiée sur **GitHub** et hébergée gratuitement par **GitHub Pages**. Sur iPhone, on l'ouvre depuis un lien dans Safari puis on l'ajoute à l'écran d'accueil (icône dédiée, plein écran) : aucune application à installer, ni App Store, ni Mac.

## Contexte d'usage
- **Utilisateurs** : un couple, Eymric (marqueur **bleu « E »**) et Marie (marqueur **rose « M »**), voyageant avec leur fille de 5 ans. Marie est enceinte : l'app doit faciliter l'accès aux soins (hôpitaux, pharmacies, numéros d'urgence) et un rythme doux.
- **Premier voyage cible** : Londres, du 27 au 30 décembre 2026 (hôtel Premier Inn London Tower Bridge). L'app doit néanmoins fonctionner pour **n'importe quelle ville du monde**.
- **Code livré sur GitHub** : dépôt public d'Eymric, publié par GitHub Pages, sur le modèle de son app « Budget ».
- **Installation guidée** : Eymric n'a pas de code à écrire ; la configuration Firebase se colle directement dans l'app, et un lien d'invitation configure le téléphone de Marie.

## Contraintes techniques
| Sujet | Choix imposé |
|---|---|
| Format | Web-app installable (PWA) : HTML, CSS, JavaScript (modules ES, Preact + htm), sans étape de compilation |
| Hébergement | GitHub Pages (gratuit), dépôt public |
| Installation | Safari › Partager › « Sur l'écran d'accueil », icône et plein écran |
| Backend | Firebase **gratuit (plan Spark)** : Authentication + Firestore (cache hors-ligne IndexedDB). Sans Firebase, l'app fonctionne en mode local sur le téléphone |
| Carte | Leaflet + fonds de carte OpenStreetMap / CARTO, sans clé |
| Données de lieux | OpenStreetMap (Nominatim, Overpass), Wikipédia, Open-Meteo, Frankfurter, sans clé |
| Sécurité | Code PIN (PBKDF2), Face ID / Touch ID via WebAuthn, coffre-fort chiffré AES-256 dans IndexedDB |
| Hors-ligne | Service worker : app, fonds de carte déjà vus, données et billets consultables sans réseau |
| Limites assumées | GPS partagé uniquement quand l'app est ouverte ; documents du coffre stockés sur chaque téléphone |

## Fonctionnalités

### 1. Authentification & verrouillage
- Connexion Firebase email / mot de passe (un compte chacun).
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
1. Architecture technique (arborescence, rôle de chaque module), icône de l'application.
2. Schéma des collections Firestore et règles de sécurité prêtes à coller.
3. Code source complet et modulaire de l'application, publié sur GitHub.
4. Guide pas à pas : ouverture du lien, ajout à l'écran d'accueil, création du projet Firebase et invitation de Marie.

## Critères de réussite
- L'app s'ouvre depuis l'écran d'accueil de l'iPhone avec son icône, et les deux téléphones voient les mêmes données en moins de 2 secondes.
- Face ID protège l'app et, à nouveau, le coffre-fort.
- Le voyage à Londres peut être créé en un clic et utilisé sans connexion pour consulter les billets.
