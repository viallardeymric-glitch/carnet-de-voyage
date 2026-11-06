# 📲 Guide pas à pas

## Étape 1 — Installer l'app sur ton iPhone (2 min)

1. Sur l'iPhone, ouvre **Safari** (pas Chrome) et va sur :
   **https://viallardeymric-glitch.github.io/carnet-de-voyage/**
2. Touche le bouton **Partager** (carré avec une flèche vers le haut), puis **Sur l'écran d'accueil**, puis **Ajouter**.
3. L'icône **Voyage** apparaît sur ton écran d'accueil. Ouvre l'app depuis cette icône à partir de maintenant.
4. Choisis **Je suis Eymric**, puis ton code PIN, puis active Face ID.
5. Touche **Créer « Noël à Londres »** : le voyage, la check-list et une douzaine d'idées sont prêts.

À ce stade, l'app fonctionne entièrement **sur ton téléphone**. Les étapes suivantes servent à la partager en direct avec Marie (planning, budget, check-list, positions).

---

## Étape 2 — Créer la base Firebase gratuite (15 min, sur ordinateur conseillé)

1. Ouvre <https://console.firebase.google.com> et connecte-toi avec ton compte Google.
2. **Créer un projet** › nom `carnet-de-voyage` › **désactive Google Analytics** › **Créer**.

**Les comptes**
3. Menu de gauche : **Créer › Authentication › Commencer**.
4. Onglet **Mode de connexion** › **Adresse e-mail/Mot de passe** › active le 1er interrupteur › **Enregistrer**.
5. Onglet **Utilisateurs › Ajouter un utilisateur** : crée ton compte (email + mot de passe), puis celui de Marie.
6. Onglet **Paramètres › Actions des utilisateurs** : **décoche « Activer la création (inscription) »** › Enregistrer. Personne d'autre ne pourra créer de compte.

**La base de données**
7. Menu de gauche : **Créer › Firestore Database › Créer une base de données** › emplacement **eur3 (Europe)** › mode **production** › **Créer**.
8. Onglet **Règles** : efface tout et colle le contenu du fichier [`firestore.rules`](../firestore.rules).
9. Dans ce texte, **remplace** `eymric@exemple.fr` et `marie@exemple.fr` par vos deux vraies adresses (en minuscules) › **Publier**.

**La configuration**
10. Roue dentée ⚙️ en haut à gauche › **Paramètres du projet** › en bas, **Vos applications** › icône **`</>`** (Web) › surnom `carnet` › **Enregistrer l'application**.
11. Firebase affiche un bloc qui commence par `const firebaseConfig = {`. **Copie tout ce bloc.** (Ces valeurs ne sont pas secrètes : la protection vient des règles de l'étape 9.)

---

## Étape 3 — Activer la synchronisation (2 min)

1. Envoie-toi le bloc copié (Notes, email…) pour l'avoir sur l'iPhone.
2. Dans l'app : **Plus › Réglages › Synchronisation**, colle le bloc, puis **Activer la synchronisation**.
3. Connecte-toi avec **ton** email et mot de passe Firebase, puis saisis ton code PIN.
4. Si tu avais déjà créé le voyage à l'étape 1 : **Réglages › Envoyer les données créées avant la synchro**. (Ou recrée simplement « Noël à Londres ».)

---

## Étape 4 — Inviter Marie (2 min)

1. Dans ton app : **Plus › Réglages › Inviter l'autre téléphone**, et envoie le lien à Marie (iMessage, WhatsApp…).
2. Marie **ouvre le lien dans Safari**, puis fait **Partager › Sur l'écran d'accueil**.
3. Elle ouvre l'app depuis l'icône, choisit **Je suis Marie**, se connecte avec **son** compte, choisit son code et Face ID.
4. Dans **Plus › Changer de voyage**, elle choisit « Noël à Londres en famille ». Vous voyez maintenant les mêmes données.

> 💡 Le lien d'invitation contient seulement la configuration Firebase, jamais de mot de passe.

---

## Étape 5 — Tester à la maison (10 min)

- Ajoutez une dépense chacun : le solde « qui doit combien à qui » se met à jour sur les deux téléphones.
- Cochez un élément de la check-list sur un téléphone : il se coche sur l'autre.
- Importez vos billets (photo, capture d'écran du QR code ou PDF) dans le **Coffre-fort**, **sur les deux téléphones**.
- Promenez-vous l'un sans l'autre, l'app ouverte : les marqueurs E et M bougent et la distance s'affiche.
- **Mode avion** : rouvrez l'app. Coffre-fort, planning et check-list restent lisibles.
- Avant le départ, parcourez la carte de Londres autour de l'hôtel et des lieux prévus : les fonds de carte vus restent disponibles hors ligne.

---

## Questions fréquentes

**C'est vraiment gratuit ?** Oui : GitHub Pages, Firebase (offre Spark), OpenStreetMap, Wikipédia et Open-Meteo sont gratuits. Seul l'assistant IA libre (facultatif) demande une clé API Claude payante à l'usage.

**Où sont mes billets ?** Uniquement sur ton iPhone, chiffrés (AES-256), dans l'app installée sur l'écran d'accueil. Ils ne passent jamais par Internet. Garde quand même les originaux dans tes emails.

**Marie ne me voit pas sur la carte.** L'app doit être ouverte sur les deux téléphones, la synchronisation active, « Partager ma position » activé, et la localisation autorisée : Réglages iPhone › Confidentialité › Service de localisation › **Sites web Safari** › « Lorsque l'app est active ».

**J'ai oublié mon code.** Sur l'écran de verrouillage, « Code oublié ? » : avec la synchronisation, tu te reconnectes avec ton email et choisis un nouveau code.

**« Missing or insufficient permissions ».** Les emails des règles Firestore (étape 2, point 9) ne correspondent pas exactement à vos comptes. Corrige-les puis **Publier**.

**Mise à jour de l'app.** Quand je publie une nouvelle version sur GitHub, elle s'installe toute seule à la prochaine ouverture avec du réseau.
