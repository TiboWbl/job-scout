# Job Scout

Une plateforme de recherche d'emploi personnalisée : les offres qui correspondent à tes critères, agrégées depuis des sources réelles et légales, classées par pertinence.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4.

## Sources de données

Seules des sources **officielles et légales** sont utilisées : aucun scraping de LinkedIn, Welcome to the Jungle, Indeed ou Apec (contraire à leurs conditions d'utilisation).

- **Pages carrière d'entreprises** (`src/lib/sources/company-boards.ts`) — active par défaut, sans clé. Beaucoup d'entreprises publient leurs offres via Greenhouse, Lever ou Ashby, qui exposent une API JSON publique (celle que leur propre widget "carrière" appelle). Une vingtaine d'entreprises sont suivies par défaut ; la liste s'étend facilement en ajoutant leur token.
- **[France Travail](https://francetravail.io)** — l'API officielle du service public de l'emploi, optionnelle.
- **[Adzuna](https://developer.adzuna.com)** — agrégateur légal avec API publique, optionnelle.

Sans les clés France Travail/Adzuna, l'app affiche déjà de vraies offres (via les pages carrière). Pour étendre la couverture :

### 1. France Travail (5 min, gratuit)

1. Crée un compte sur [francetravail.io](https://francetravail.io)
2. Dans ton espace, crée une nouvelle application (ex. "Job Scout")
3. Abonne l'application à l'API **"Offres d'emploi v2"** depuis le catalogue
4. Récupère l'**Identifiant client** et la **Clé secrète** affichés sur la page de l'application

### 2. Adzuna (2 min, gratuit)

1. Inscris-toi sur [developer.adzuna.com](https://developer.adzuna.com)
2. Ton **App ID** et ta **App Key** s'affichent directement sur le tableau de bord

### 3. Configurer l'app

```bash
cp .env.local.example .env.local
# puis colle tes 4 clés dans .env.local
```

Redémarre `npm run dev` — les offres apparaissent au prochain chargement de `/`.

## Offres retirées

Les offres enregistrées sont revérifiées périodiquement (toutes les 6h au chargement de `/enregistrees`). Pour les offres France Travail, l'API permet de savoir si une offre a été dépubliée — elle apparaît alors grisée avec la mention "Offre retirée". Adzuna n'expose pas d'équivalent dans son API publique, donc ce suivi ne s'applique qu'aux offres France Travail pour l'instant.

## État actuel

Tout est stocké en local (`localStorage`), propre à chaque navigateur — pas encore de compte ni de backend partagé entre utilisateurs. Le texte de CV collé/importé dans l'outil d'analyse ne quitte jamais le navigateur non plus (aucun appel serveur).

## Pages

- **Nouvelles offres** (`/`) — le flux principal, trié par score de correspondance avec les critères.
- **Offres enregistrées** (`/enregistrees`) — les offres mises de côté, avec statut "retirée" si applicable.
- **Suivi** (`/suivi`) — tableau par étape (intéressé → candidature envoyée → entretien → offre/refus) pour noter où en est chaque candidature, avec notes libres. Alimenté depuis le détail d'une offre ou ajouté manuellement (utile pour une offre trouvée sur LinkedIn, WTTJ, etc.).
- **Analyse CV** (`/cv`) — colle ton CV ou importe un PDF, obtiens un score façon ATS avec des retours concrets (sections, mots-clés alignés avec tes critères, réalisations chiffrées…). 100% local, aucune IA externe, aucun envoi réseau.
- **Critères de recherche** (`/criteres`) — poste, missions recherchées, domaine, localisation, contrat, salaire, taille d'entreprise, sources à suivre, mots-clés à exclure, et priorités.
- **Paramètres** (`/parametres`) — apparence (clair/sombre/système) et réinitialisation des données locales.

## Démarrer

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).
