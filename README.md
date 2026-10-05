# Scout

Toute sa recherche d'emploi dans un seul onglet : les offres qui correspondent vraiment, expliquées, et le suivi des candidatures. Calme, transparent, multi-utilisateurs.

La spécification complète est dans [SPEC.md](SPEC.md). Les maquettes de la direction visuelle retenue sont dans [design/mockups](design/mockups/index.html).

## Ce que fait la version actuelle

- **Connexion Google** et profil privé (row-level security Postgres).
- **Onboarding en langage naturel** : quelques phrases, et un CV en option, deviennent des critères modifiables en puces (métier, variantes d'intitulés FR/EN, passerelles, secteurs, zone, contrats, expérience).
- **Collecte légale** : API publiques des pages carrière (Greenhouse, Lever, Ashby), France Travail et Adzuna en option. Pas de filtre sur l'intitulé à la collecte, dédoublonnage entre sources, archivage des offres retirées.
- **Tri en deux temps** :
  1. des **portes** déterministes : zone, contrat, séniorité relative à l'expérience, écart d'expérience. Une offre qui en viole une est écartée ou mise à part, jamais compensée par le reste ;
  2. un **LLM** qui lit la description complète, d'abord le profil recherché, et juge le poste réel. Il attribue un niveau (Coup de cœur, Solide, Tremplin, Écartée), un « pourquoi », des points forts et d'attention.
- **Fil d'offres** avec panneau de détail, raisons « Pas pour moi », vue des offres écartées avec leur raison, et le flux Postuler → « Tu as postulé ? » → **Suivi** (kanban).

## Architecture

```
GitHub Actions / bouton admin ──► collecte (TypeScript) ──► Supabase Postgres ◄── Next.js sur Vercel
   Greenhouse · Lever · Ashby          normalisation              offres, entreprises (partagées)
   France Travail · Adzuna             dédoublonnage              profils, scores, suivi (privés, RLS)
                                       couleur des logos
                                                     scoring à la demande (portes → Mistral par lots)
```

| Dossier | Rôle |
|---|---|
| `src/lib/collect` | Connecteurs, normalisation, dédoublonnage, orchestration de la collecte |
| `src/lib/domain` | Modèle : critères (zod), géographie, signaux (contrat, expérience, séniorité) |
| `src/lib/scoring` | Portes du préfiltre, pré-tri lexical, jugement LLM, moteur par budget de temps |
| `src/lib/llm` | Abstraction du fournisseur (Mistral ou repli déterministe), file à 1 requête/s |
| `src/lib/privacy` | Retrait des données personnelles du CV avant tout appel au LLM |
| `src/lib/design` | Couleur d'accent des entreprises et contrôle de contraste WCAG AA |
| `supabase/migrations` | Schéma et politiques row-level security |

Choix notables :
- **Gratuit à 100 %** : Vercel Hobby, Supabase Free, Mistral (plan gratuit), logo.dev (plan gratuit).
- **Scoring en tranches de 45 s** : chaque appel tient dans la limite d'une fonction Vercel Hobby, et l'interface relance jusqu'à ce que tout soit évalué.
- **Une seule couleur stockée** par entreprise (le code hex extrait du logo), jamais une copie du logo.
- **Logs de collecte agrégés par source**, sans aucune donnée d'utilisateur (le repo et ses logs CI sont publics).

## Installation

```bash
npm install
cp .env.local.example .env.local   # puis remplir, voir ci-dessous
npm run db:migrate                 # crée le schéma dans Supabase
npm run dev
```

**Supabase**
- Crée un projet (région Paris).
- Récupère l'URL, la clé publique et la clé secrète dans *Project Settings → API Keys*.
- Récupère l'URI du *Session pooler* pour `SUPABASE_DB_URL`. Elle sert uniquement en local, pour les migrations.
- Dans *Authentication → URL Configuration*, ajoute `http://localhost:3000/**` et l'URL Vercel aux Redirect URLs.

**Google OAuth**
- Dans Google Cloud Console, crée un client « Web application ».
- Origine : `http://localhost:3000`, plus l'URL Vercel.
- Redirect URI : `https://<ref-projet>.supabase.co/auth/v1/callback`.
- Colle l'ID et le secret dans Supabase, sous *Authentication → Providers → Google*.

**Mistral**
- Clé API du plan gratuit.
- Désactive « Anonymous improvement data » dans *Admin → Privacy*.
- Sans clé, `LLM_PROVIDER=mock` donne une évaluation automatique simplifiée.

**Admin**
- `ADMIN_EMAIL` = ton adresse Google.
- Elle donne accès à la page Admin : collecte manuelle et santé des sources.

## Scripts

| Commande | Effet |
|---|---|
| `npm run collect` | Une passe de collecte complète (comptes agrégés en sortie) |
| `npm run dry-run` | Collecte réelle + portes du préfiltre en mémoire, sans base, pour contrôler la qualité |
| `npm test` | Tests unitaires et portes des 11 cas de non-régression |
| `npm run test:llm` | Les 11 cas complets, prompt inclus (nécessite `MISTRAL_API_KEY`) |

## Confidentialité

- **Le CV n'est pas conservé.** Avant toute analyse, son texte est débarrassé du nom, de l'email, du téléphone, des liens et de l'adresse. Seules les compétences et l'expérience extraites sont stockées.
- **Les données privées sont isolées par la base elle-même** (row-level security) : profil, scores, actions et suivi.
- **Les clés** sont uniquement en variables d'environnement. L'historique git est vérifié avec gitleaks.
