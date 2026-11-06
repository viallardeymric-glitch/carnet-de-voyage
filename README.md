# ✈️ Carnet de Voyage

Web-app de voyage familiale pour Eymric (marqueur bleu **E**) et Marie (marqueur rose **M**) : carte interactive, positions partagées en direct, planning à deux, coffre-fort de billets chiffré et protégé par Face ID, budget partagé, check-list, urgences, journal et assistant.

**👉 Ouvrir l'app : <https://viallardeymric-glitch.github.io/carnet-de-voyage/>**
Sur iPhone : dans Safari, bouton Partager › **Sur l'écran d'accueil**.

Guide pas à pas : [docs/GUIDE_INSTALLATION.md](docs/GUIDE_INSTALLATION.md) · Cahier des charges : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)

## Fonctionnalités

| Onglet | Ce qu'il fait |
|---|---|
| 🗺️ **Carte** | Lieux de n'importe quelle ville par catégorie (Restaurants, Loisirs & enfants, Shopping, Monuments, Musées, Abri pluie, Santé), filtre « Ouvert maintenant », nos lieux (❤️ coup de cœur, ✓ visité, J1/J2…), hôtel, positions E/M en direct et distance entre vous |
| 📍 **Fiche lieu** | Photo et histoire (Wikipédia), horaires, site, téléphone, avis Google / Tripadvisor, « J'adore ! », planifier, « Y aller » à pied / transports / voiture vers Plans, Google Maps ou Citymapper, temps de marche au rythme d'un enfant de 5 ans |
| 📅 **Planning** | Boîte à idées partagée, programme jour par jour, réordonner, **optimiser le trajet du jour** (plus proche voisin + 2-opt depuis l'hôtel), statuts, rappel de pause repos |
| 🔒 **Coffre-fort** | Face ID ou code à chaque ouverture, billets / QR codes / PDF **chiffrés AES-256** et stockés uniquement sur le téléphone (hors ligne), analyse d'une confirmation de réservation collée |
| 💶 **Budget** | Dépenses à deux en devise locale ou en euros, « qui doit combien à qui », répartition par catégorie, convertisseur en direct |
| ➕ **Plus** | Assistant (heure + météo + lieux proches, IA Claude en option), check-list synchronisée pré-remplie (grossesse, enfant, Royaume-Uni), urgences (numéros du pays, hôpitaux et pharmacies proches, notes médicales), journal de bord avec photos, réglages |

**Deux modes :** sans configuration, tout est enregistré sur le téléphone. En collant une configuration Firebase (gratuit), les données se synchronisent en direct entre les deux iPhone ; un lien d'invitation configure le second téléphone.

**Sécurité :** code PIN dérivé PBKDF2, Face ID / Touch ID (WebAuthn), reverrouillage après 1 minute en arrière-plan, coffre-fort chiffré, règles Firestore limitées à vos deux adresses email.

## Architecture (sans étape de compilation)

```
index.html               Page unique, icônes, manifest, service worker
manifest.webmanifest     Installation sur l'écran d'accueil
sw.js                    Hors-ligne : fichiers de l'app + fonds de carte déjà vus
icons/                   Icône de l'app (SVG source + PNG)
css/app.css              Charte marine #002B49 / cyan #00A3E0, mode sombre automatique
vendor/                  Preact + htm, Leaflet, Firebase, opening_hours, Font Awesome (copies locales)
firestore.rules          Règles de sécurité à coller dans la console Firebase
js/
  main.js                Démarrage, enchaînement profil → connexion → PIN → verrou → onglets
  core/                  config (réglages, Firebase, invitation), store (local / Firestore),
                         lock (PIN, Face ID), vault (coffre chiffré), location (GPS croisé), app (navigation)
  lib/                   places (OSM, Wikipédia), geo (distances, optimisation), routing (Y aller),
                         currency, weather, bookingParser, assistant, trips, dates, openNow
  data/                  Catégories, urgences, check-list type, voyage Londres pré-rempli
  ui/                    Composants, fenêtres, clavier PIN
  views/                 Un fichier par écran
```

## Schéma Firestore

```
trips/{tripId}
  name, startDate "AAAA-MM-JJ", endDate, notes, createdBy "E"|"M", createdAtMs
  city    { name, country, countryCode, currency, lat, lon }
  lodging { name, address, lat, lon } | null

  places/{id}       osmId?, name, category, lat, lon, tags{…}, day (null = boîte à idées),
                    order, status "todo"|"visited", favorite, note, addedBy
  expenses/{id}     label, amount, currency, amountEur, paidBy, forWhom "both"|"E"|"M", category, date
  checklist/{id}    label, section, done, doneBy, order
  journal/{id}      text, photo (JPEG ≈100 Ko), day, author, createdAtMs
  positions/{E|M}   lat, lon, accuracy, sharing, updatedAtMs
  meta/medical      text (notes médicales partagées)
```

Le coffre-fort n'est **jamais** envoyé dans Firestore : il reste chiffré dans le téléphone.

## Sources de données (gratuites, sans clé)
OpenStreetMap (Nominatim, Overpass), CARTO (fonds de carte), Wikidata / Wikipédia, Open-Meteo, Frankfurter (BCE) et open.er-api.

## Limites connues
- Sur iPhone, une web-app ne partage la position que lorsqu'elle est ouverte à l'écran.
- Les documents du coffre-fort sont à importer sur chaque téléphone.

## Développement
Aucun outil requis : servir le dossier (`python3 -m http.server`) et ouvrir `http://localhost:8000`.
Les fichiers de `vendor/` sont des copies figées des bibliothèques (Preact 10, Leaflet 1.9, Firebase 12, opening_hours 3.15, Font Awesome 7).
