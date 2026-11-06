# ✈️ Carnet de Voyage — app iOS familiale

Application de voyage pour Eymric (marqueur bleu **E**) et Marie (marqueur rose **M**) : carte interactive, positions partagées en direct, planning à deux, coffre-fort de billets protégé par Face ID, budget partagé, check-list, urgences, journal et assistant.

Construite avec **React Native / Expo** (SDK 58) et **Firebase** (offre gratuite), elle s'utilise sur iPhone via **Expo Go**, sans Mac ni compte développeur Apple.

➡️ **Pour l'installer : [docs/GUIDE_INSTALLATION.md](docs/GUIDE_INSTALLATION.md)**
➡️ Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)

## Fonctionnalités

| Onglet | Ce qu'il fait |
|---|---|
| 🗺️ **Carte** | Lieux de n'importe quelle ville par catégorie (Restaurants, Loisirs & enfants, Shopping, Monuments, Musées, Abri pluie, Santé), filtre « Ouvert maintenant », nos lieux enregistrés (❤️ coup de cœur, ✓ visité, J1/J2…), hôtel, positions E/M en direct et distance entre vous |
| 📍 **Fiche lieu** | Photo et histoire (Wikipédia), horaires, site, téléphone, avis Google / Tripadvisor, « J'adore ! », planifier, « Y aller » à pied / transports / voiture vers Plans, Google Maps ou Citymapper, temps de marche au rythme d'un enfant de 5 ans |
| 📅 **Planning** | Boîte à idées partagée, programme jour par jour, réordonner, **optimiser le trajet du jour** (plus proche voisin + 2-opt depuis l'hôtel), statuts, rappel de pause repos |
| 🔒 **Coffre-fort** | Face ID à chaque ouverture, billets / QR codes / PDF stockés uniquement sur le téléphone (hors ligne), analyse d'une confirmation de réservation collée (référence, vols, dates, heures, montant) |
| 💶 **Budget** | Dépenses à deux en devise locale ou en euros, « qui doit combien à qui », répartition par catégorie, convertisseur en direct (taux gardés pour le hors-ligne) |
| ➕ **Plus** | Assistant (heure + météo + lieux proches, IA Claude en option), check-list synchronisée pré-remplie (grossesse, enfant, Royaume-Uni), urgences (numéros du pays, hôpitaux et pharmacies proches, notes médicales), journal de bord avec photos, réglages |

Sécurité : connexion Firebase, verrouillage par code PIN (haché, trousseau iOS) et Face ID, reverrouillage après 1 minute en arrière-plan, règles Firestore limitées à vos deux adresses email.

## Architecture

```
App.js                     Navigation + enchaînement connexion → profil → PIN → verrou → app
firestore.rules            Règles de sécurité à coller dans la console Firebase
src/
  config/firebase.js       ⚙️ Configuration Firebase (à remplir)
  config/settings.js       ⚙️ Membres (noms, couleurs, emails), réglages
  theme.js                 Palette marine #002B49 / cyan #00A3E0, mode sombre automatique
  context/                 AuthContext (session + profil E/M), LockContext (PIN/Face ID), TripContext (voyage actif)
  hooks/useCollection.js   Firestore temps réel + copie locale pour le hors-ligne
  hooks/useLiveLocation.js Géolocalisation croisée
  services/                places (OSM, Wikipédia), geo (distances, optimisation), routing (Y aller),
                           currency, weather, vault (coffre), bookingParser, assistant, trips, dates
  data/                    Catégories, numéros d'urgence, check-list type, voyage Londres pré-rempli
  components/              UI (cartes, boutons, puces, encadrés Sécurité & Santé), PinPad
  screens/                 Un fichier par écran
```

### Sources de données (gratuites, sans clé)
OpenStreetMap (Nominatim pour les villes et adresses, Overpass pour les lieux), Wikidata / Wikipédia (photos, histoire), Open-Meteo (météo), Frankfurter / BCE et open.er-api (taux de change). Les avis renvoient vers Google Maps et Tripadvisor, car aucune source gratuite ne fournit d'avis.

## Schéma Firestore

```
trips/{tripId}
  name, startDate "AAAA-MM-JJ", endDate, notes, createdBy "E"|"M", createdAt
  city    { name, country, countryCode, currency, lat, lon }
  lodging { name, address, lat, lon } | null

  places/{placeId}        osmId?, name, category, lat, lon, tags{…},
                          day (null = boîte à idées, 1..N = jour), order,
                          status "todo"|"visited", favorite, note, addedBy
  expenses/{id}           label, amount, currency, amountEur, paidBy "E"|"M",
                          forWhom "both"|"E"|"M", category, date, createdBy, createdAtMs
  checklist/{id}          label, section, done, doneBy, order
  journal/{id}            text, photo (JPEG base64 ≈100 Ko), day, author, createdAtMs
  positions/{"E"|"M"}     lat, lon, accuracy, sharing, updatedAt
  meta/medical            text (notes médicales partagées)
```

Le coffre-fort n'est **pas** dans Firestore : fichiers et index restent dans l'espace privé de l'app sur chaque iPhone.

## Limites connues (Expo Go)
- Le partage de position fonctionne quand l'app est ouverte (pas en arrière-plan).
- Les documents du coffre-fort sont à importer sur chaque téléphone.
- Le « glisser-déposer » du planning se fait par boutons (déplacer vers un jour, monter / descendre).

## Développement
```bash
npm install
npx expo start      # puis scanner le QR code avec l'iPhone
npx expo lint
```
