# 📲 Guide d'installation pas à pas

Durée : environ 45 minutes la première fois. Aucune ligne de code à écrire : on copie-colle seulement quelques informations.

**Ce qu'il vous faut :** un ordinateur (Windows ou Mac), vos deux iPhone, une connexion Wi-Fi commune, et votre compte Google (pour Firebase).

---

## Étape 1 — Installer les outils (15 min)

1. **Sur l'ordinateur**, installez **Node.js** : allez sur <https://nodejs.org>, téléchargez la version **LTS**, lancez l'installeur et cliquez « Suivant » jusqu'au bout.
2. **Sur les deux iPhone**, installez l'app **Expo Go** depuis l'App Store (gratuite).
3. Créez un compte gratuit sur <https://expo.dev/signup> et connectez-vous dans Expo Go avec ce compte (onglet *Profile*). Utile pour l'étape 7.

---

## Étape 2 — Créer la base Firebase (15 min)

1. Ouvrez <https://console.firebase.google.com> et connectez-vous avec votre compte Google.
2. Cliquez **« Créer un projet »**, nommez-le `carnet-de-voyage`, **désactivez Google Analytics** (inutile), puis **Créer**.

### 2a. Les comptes de connexion
3. Menu de gauche : **Créer › Authentication › Commencer**.
4. Onglet **Mode de connexion** : choisissez **Adresse e-mail/Mot de passe**, activez le premier interrupteur, **Enregistrer**.
5. Onglet **Utilisateurs › Ajouter un utilisateur** : créez votre compte (votre email + un mot de passe), puis recommencez pour Marie.
6. Onglet **Paramètres › Actions des utilisateurs** : **décochez « Activer la création (inscription) »** puis Enregistrer. Ainsi, personne d'autre ne peut se créer de compte.

### 2b. La base de données
7. Menu de gauche : **Créer › Firestore Database › Créer une base de données**.
8. Emplacement : **eur3 (Europe)**. Mode : **production**. Cliquez **Créer**.
9. Onglet **Règles** : effacez tout, puis collez le contenu du fichier [`firestore.rules`](../firestore.rules) du projet.
10. Dans ce texte collé, **remplacez** `eymric@exemple.fr` et `marie@exemple.fr` par **vos deux vraies adresses** (en minuscules), puis **Publier**.

### 2c. La « clé » de l'application
11. En haut à gauche, roue dentée ⚙️ **› Paramètres du projet**.
12. En bas, section **Vos applications** : cliquez l'icône **`</>`** (Web). Surnom : `carnet`. Ne cochez pas Hosting. **Enregistrer l'application**.
13. Firebase affiche un bloc `const firebaseConfig = { apiKey: "...", ... }`. **Gardez cette page ouverte** : on en a besoin à l'étape 4.

---

## Étape 3 — Récupérer le code (2 min)

1. Sur GitHub, ouvrez votre dépôt **carnet-de-voyage**.
2. Bouton vert **Code › Download ZIP**.
3. Décompressez le ZIP, par exemple dans *Documents*. Vous obtenez un dossier `carnet-de-voyage-main`.

---

## Étape 4 — Brancher votre Firebase (5 min)

Ouvrez les fichiers ci-dessous avec un éditeur de texte simple (Bloc-notes sur Windows, TextEdit sur Mac en *Format › Convertir au format texte*), ou mieux, avec **Visual Studio Code** (gratuit).

1. **`src/config/firebase.js`** : remplacez chaque `COLLEZ_ICI` par la valeur correspondante affichée par Firebase (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId). Gardez les apostrophes `'…'` autour des valeurs.
2. **`src/config/settings.js`** : remplacez `eymric@exemple.fr` et `marie@exemple.fr` par vos deux adresses. L'app reconnaîtra alors automatiquement qui est connecté (E bleu ou M rose).
3. Enregistrez les deux fichiers.

---

## Étape 5 — Lancer l'app sur votre iPhone (5 min)

1. Ouvrez un **terminal** :
   - Windows : touche Windows, tapez `PowerShell`, Entrée.
   - Mac : Cmd + Espace, tapez `Terminal`, Entrée.
2. Allez dans le dossier du projet. Tapez `cd ` (avec un espace), **glissez le dossier `carnet-de-voyage-main` dans la fenêtre**, puis Entrée.
3. Tapez ces deux commandes (Entrée après chacune, la première prend quelques minutes) :
   ```
   npm install
   npx expo start
   ```
4. Un grand **QR code** s'affiche. Sur l'iPhone (même Wi-Fi), ouvrez l'**appareil photo**, visez le QR code et touchez le lien « Ouvrir dans Expo Go ».
5. L'app se charge. Connectez-vous, choisissez votre code PIN, autorisez la position et Face ID.
6. Touchez **« Créer Noël à Londres (27–30 déc. 2026) »** : le voyage, la check-list et une douzaine d'idées sont créés.
7. **Marie** fait la même chose (étape 5.4) sur son iPhone, avec son compte : vous voyez maintenant les mêmes données, en direct.

> 💡 Si Expo Go affiche « Project is incompatible with this version of Expo Go », tapez `npx expo install expo@latest` puis `npx expo install --fix`, puis relancez `npx expo start`. Ou demandez-moi de mettre le code à jour.

---

## Étape 6 — Tester à la maison (10 min)

- Ajoutez une dépense chacun et vérifiez le solde « qui doit combien à qui ».
- Cochez un élément de la check-list sur un téléphone : il se coche sur l'autre.
- Importez vos billets (photo ou PDF) dans le **Coffre-fort**, **sur les deux téléphones**.
- Promenez-vous l'un sans l'autre pour voir les marqueurs E et M bouger et la distance s'afficher.
- **Coupez le Wi-Fi et la 4G** : le coffre-fort, le planning et la check-list doivent rester lisibles.

---

## Étape 7 — Pendant le voyage, sans ordinateur

Avec `npx expo start`, l'app est servie par votre ordinateur. Pour l'utiliser à Londres sans lui, publiez-la une fois sur votre compte Expo (gratuit), depuis le dossier du projet :

```
npx eas-cli@latest login
npx eas-cli@latest update:configure
npx eas-cli@latest update --branch production --message "Version Londres"
```

Ensuite, sur <https://expo.dev>, ouvrez le projet **carnet-de-voyage › Updates**, cliquez la mise à jour, puis **Preview** : scannez le QR code avec chaque iPhone. Expo Go garde l'app dans **Projets récents**.

⚠️ **Faites ce test au moins une semaine avant le départ**, ordinateur éteint. Si quelque chose bloque, dites-le-moi : je vous guiderai.

---

## Questions fréquentes

**Est-ce vraiment gratuit ?** Oui : Firebase (offre Spark), Expo, Expo Go, OpenStreetMap, Wikipédia, Open-Meteo et le dépôt GitHub privé sont gratuits. Seul l'assistant IA libre (facultatif) demande une clé API Claude payante à l'usage.

**Où sont mes billets ?** Uniquement sur votre iPhone, dans l'espace privé de l'app, chiffré par iOS. Ils ne passent jamais par Internet. Revers : si vous supprimez Expo Go, ils disparaissent. Gardez les originaux dans vos emails.

**Marie ne me voit pas sur la carte.** Vérifiez que l'app est ouverte sur les deux téléphones, que « Partager ma position » est activé (Plus › Réglages) et que la position est autorisée (Réglages iPhone › Expo Go › Position › Lorsque l'app est active).

**J'ai oublié mon code PIN.** Sur l'écran de verrouillage, touchez « Code oublié ? Se reconnecter » : vous vous reconnectez avec votre email et choisissez un nouveau code. Les documents du coffre restent en place.

**« Missing or insufficient permissions ».** Les emails dans les règles Firestore (étape 2b) ne correspondent pas exactement à vos comptes. Corrigez-les puis **Publier**.
