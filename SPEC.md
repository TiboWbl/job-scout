# Scout : spécification produit et technique

Dernière mise à jour : 5 octobre 2026.

## Vision

- **Un seul onglet ouvert pour gérer toute sa recherche d'emploi de A à Z.** Trouver les offres, les comprendre, postuler (redirection vers le site de l'offre), suivre ses candidatures, améliorer son CV. Tout part de Scout.
- Objectif : **décrocher un job**, pas uniquement le job de rêve. Faire remonter toutes les offres pertinentes, y compris celles qu'on n'aurait jamais vues seul : trop de sites, trop de pages carrière, entreprises inconnues.
- **Une plateforme où l'on a envie de revenir.** Les sites de recrutement sont souvent oppressants. Scout doit être calme, beau et rassurant.
- **Multi-utilisateurs dès le départ.** L'auteur est l'utilisateur 0, mais n'importe quel ami doit pouvoir créer un compte via un lien d'invitation et paramétrer sa propre recherche, sur un métier complètement différent. Rien de spécifique à un utilisateur ou à un métier n'est codé en dur.
- Projet vitrine : montré en entretien et dans un portfolio. Code propre, architecture lisible, README soigné.

## Principes non négociables

- **Gratuit à 100 %.** Aucun service payant, aucune carte bancaire. Toute fonctionnalité qui en exigerait un est signalée avant d'être construite.
- **Rappel avant précision.** Rater une offre pertinente est pire qu'afficher une offre moyenne en bas du classement. On collecte large et on classe intelligemment ; jamais de filtres durs en amont.
- **Simplicité.** Trois usages principaux : rechercher, suivre, dire ce qu'on cherche. Chaque écran se comprend sans explication. Rien de superflu : tout élément visible est utile à l'utilisateur, sinon il n'a rien à faire là.
- **Transparence.** Chaque offre affiche pourquoi elle est proposée. Chaque exclusion est consultable avec sa raison.
- **Calme.** Pas de mécanique anxiogène (voir « Design et ambiance »).
- **Design = exigence fonctionnelle, pas finition.** C'est la raison n°1 d'utiliser Scout chaque jour. Le design system est défini avant l'interface.
- **Données personnelles protégées.** Nom, email, téléphone et adresse ne sont jamais envoyés au LLM.

## Infrastructure (gratuite)

| Besoin | Service | Limite à respecter |
|---|---|---|
| Front + API | Vercel Hobby | Usage non commercial ; pas de Vercel Cron (1/jour max) |
| Base, auth, stockage CV | Supabase Free | 500 Mo de base, 1 Go de stockage ; projet mis en pause après 7 jours sans activité (évité par la collecte planifiée) |
| Collecte et scoring planifiés | GitHub Actions, 2 à 3 fois par jour | Illimité si le repo est public ; 2 000 min/mois si privé |
| LLM | Mistral, plan gratuit « Experiment » | 1 requête/s, quota mensuel de tokens ; désactiver l'usage des données pour l'entraînement dans la console (Admin > Privacy) |
| Logos | logo.dev (plan Community) ou Brandfetch | 500 000 requêtes/mois ; pas d'attribution requise pour un projet personnel non commercial |
| Notifications | Bot Telegram ; email optionnel via SMTP Gmail (mot de passe d'application) | |

Rétention : les descriptions des offres archivées depuis plus de 60 jours sont purgées (titre, entreprise, dates et URL sont conservés) pour rester sous 500 Mo.

## Structure de l'application (une seule page)

- Application monopage avec une navigation persistante : **Aujourd'hui**, **Offres**, **Entreprises**, **Suivi**, **Mon CV**, **Ma recherche**.
- Les détails (offre, entreprise, candidature) s'ouvrent dans un panneau latéral, sans quitter la page.
- Recherche universelle et actions rapides via ⌘K (offres, entreprises, candidatures, ajout d'une offre par URL).
- **Aujourd'hui** (écran d'accueil) : sélection du jour, relances à faire, entretiens à venir, progression de la semaine. En 30 secondes on sait quoi faire aujourd'hui.

## Comptes et onboarding

- Connexion **Google uniquement** (gratuit, aucun email à envoyer). Accès sur invitation (lien d'invitation) pour maîtriser les quotas.
- Onboarding en moins de 5 minutes :
  - Upload du CV en PDF (recommandé, pas obligatoire). Les coordonnées sont retirées côté serveur avant tout envoi au LLM, qui en extrait l'expérience, les compétences, la séniorité réelle et les langues. **L'onboarding le dit clairement.**
  - « Décris ce que tu cherches en quelques phrases » : texte libre.
  - Le LLM transforme le tout en critères structurés, affichés sous forme de puces modifiables.
  - Première sélection affichée immédiatement à partir du stock d'offres déjà collectées.
- Pas d'option « coller des offres aimées » : la personnalisation passe par le bouton « Pas pour moi » et sa raison.
- Le profil de chaque utilisateur alimente la collecte : ses intitulés et secteurs deviennent de nouvelles requêtes. Plus il y a d'utilisateurs, plus la couverture s'élargit.

## Ma recherche (paramètres)

- Pas de formulaire à 30 filtres. Un champ en langage naturel (« je cherche… ») converti par le LLM en critères éditables :
  - métier cible et toutes ses variantes d'intitulés FR/EN (générées automatiquement, modifiables) ;
  - métiers passerelles acceptés ;
  - secteurs prioritaires, acceptés, à éviter ;
  - lieu et télétravail (zone géographique explicite : une offre à New York n'apparaît pas pour une recherche à Paris) ;
  - contrats ;
  - expérience réelle ;
  - langues ;
  - entreprises à éviter ou à suivre ;
  - deal-breakers en texte libre.
- Les mêmes critères restent modifiables directement par filtres, sans passer par le texte.
- Curseur d'ouverture : « job de rêve uniquement » ↔ « je veux surtout commencer quelque part ».
- Aperçu en direct de l'effet des critères (« ≈ X offres par semaine avec ces réglages »).
- Toute modification déclenche le re-scoring des offres actives (profil versionné).

## Sources et découverte

- Connecteurs indépendants en **TypeScript** avec une interface commune (`fetch` → offres normalisées). L'échec d'un connecteur ne bloque jamais les autres.
- **Pages carrière via les API publiques des ATS** (brique prioritaire) :
  - Lever (`api.lever.co/v0/postings/{slug}?mode=json`)
  - Greenhouse (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`)
  - Ashby (`api.ashbyhq.com/posting-api/job-board/{slug}`)
  - Recruitee (`{slug}.recruitee.com/api/offers/`)
  - SmartRecruiters, Workable, Personio, Teamtailor.
  - Détection automatique de l'ATS à partir de l'URL de la page carrière ; repli sur un scraping simple de la page carrière de l'entreprise si aucun flux public n'existe.
- **Agrégateurs officiels** :
  - API France Travail (Offres d'emploi v2) ;
  - API Adzuna.
  - Requêtes générées à partir de toutes les variantes d'intitulés de tous les profils, avec pagination complète.
- Pas de LinkedIn, Indeed, Glassdoor, Google Jobs ni Welcome to the Jungle : aucun accès légal et gratuit.
- **Annuaire d'entreprises partagé et auto-enrichi** :
  - Chaque entreprise vue dans une offre, quelle que soit la source, est ajoutée à l'annuaire. Sa page carrière et son ATS sont détectés, puis elle est surveillée en continu.
  - Import en masse possible (CSV, listes d'URL, annuaires sectoriels, incubateurs).
  - Fiche entreprise : logo, photo, description, secteur, taille, offres ouvertes, lien carrière.
- Onglet **Entreprises** : découvrir les entreprises qui correspondent à ma recherche, même sans offre ouverte, et les suivre.
- Collecte 2 à 3 fois par jour via GitHub Actions.
- **Monitoring de santé par source** : offres par run, erreurs, alerte si une source tombe à zéro ou chute anormalement.

## Normalisation et déduplication

- Schéma commun : titre, entreprise, lieu (ville, pays), télétravail, contrat, XP demandée, salaire, langue, description complète, URL(s), source(s), date de publication, date de première détection.
- Toujours récupérer la description complète.
- Dédup cross-sources par entreprise + titre normalisé + similarité de description. Garder toutes les URLs et privilégier le lien direct entreprise pour postuler.
- Archiver les offres retirées. Ne jamais rejeter une offre pour un champ manquant.

## Préfiltre et scoring

- Préfiltre par utilisateur limité aux exclusions sûres :
  - zone hors périmètre ;
  - contrat exclu ;
  - intitulé clairement trop senior (Senior, Lead, Head, Staff, Principal, Director, VP) ;
  - entreprise évitée.
- Pas d'exigence de mot-clé exact dans le titre.
- Pas d'embeddings au départ (aucun fournisseur gratuit retenu) : le préfiltre et une file d'attente plafonnée suffisent. À réévaluer si le volume l'exige.
- Le LLM lit la description complète et juge le **poste réel**, pas l'intitulé. Il lit **en priorité « Profil recherché » / « Qualifications »** pour estimer les chances. Il détecte les pièges : intitulé trompeur, poste commercial déguisé, missions sans rapport avec le titre.
- Sortie JSON validée par un schéma :
  - `score_interet` (0-100) : alignement avec ce que l'utilisateur cherche ;
  - `score_chances` (0-100) : XP demandée vs réelle, compétences requises vs CV, langue, type d'entreprise, atouts différenciants ;
  - `score_tremplin` (0-100) : valeur comme étape de carrière (apprentissage, encadrement, passerelle vers le métier cible) ;
  - `niveau` ;
  - `pourquoi` (1-2 phrases), `points_forts`, `points_d_attention` ;
  - `leviers_cv` : intitulé à reprendre, compétences à remonter, expérience à mettre en avant.
- Niveaux, avec des libellés bienveillants :
  - **Coup de cœur** : le métier visé dans un secteur prioritaire.
  - **Solide** : le métier visé, autre secteur, bonne entreprise.
  - **Tremplin** : métier passerelle avec un chemin crédible.
  - **Écartée** : avec raison, consultable.
- XP demandée supérieure à l'XP réelle : baisser le score Chances, ne pas exclure (seuil d'exclusion autour de 5 ans d'écart). Un junior peut viser des postes jusqu'à 3-5 ans d'expérience demandée.
- Le curseur d'ouverture pondère le classement entre Intérêt, Chances et Tremplin.
- Cache par couple (offre, version du profil).
- **LLM** : Mistral derrière une couche d'abstraction (changer de fournisseur = changer une variable d'environnement). `mistral-small` pour le scoring ; un modèle plus gros pour l'analyse de CV et la conversion des critères. File d'attente à 1 requête/seconde avec retry sur 429. **Scoring par lots de 5 à 10 offres par requête** pour limiter l'attente.
- **Test de non-régression** automatique, rejoué à chaque modification du prompt. Offres fictives rédigées pour le test, sans nom d'entreprise réel.
  - Préfiltre et pièges :
    1. Offre « Senior Product Manager, 7+ ans » pour un profil junior : écartée par le préfiltre.
    2. Offre basée à New York pour une recherche à Paris : écartée par le préfiltre.
    3. Intitulé trompeur (« Product Manager » dont les missions sont celles d'un chef de projet événementiel) : score Intérêt bas.
    4. Poste commercial déguisé (« Business Developer Produit », 80 % de prospection) : score Intérêt bas, signalé en point d'attention.
    5. Bon poste sous un autre intitulé (« Responsable produit digital ») : retenu en Coup de cœur ou Solide.
    6. Offre demandant 3 ans d'expérience pour un profil junior : non exclue, score Chances réduit.
  - Niveaux (profil test : PM junior, ~1 an d'XP, Paris, secteurs sport et santé) :
    7. Associate PM dans une healthtech, profil ingénieur demandé, mentorat structuré : **Coup de cœur**.
    8. Junior PM dans une scale-up ameublement/déco financée, vrai poste produit digital : **Solide**.
    9. « Junior Product Manager » dans une marque de mode, en réalité développement de collection textile : **Écartée**.
    10. QA Analyst dans un cabinet de conseil produit, passerelle annoncée QA → PO → PM : **Tremplin**.
    11. Customer Experience Specialist chez un fabricant d'objets connectés santé : **Tremplin**, score bas.

## Offres (fil)

- **Sélection du jour finie et curée**, pas un scroll infini. Classement par niveau puis score.
- Cartes : logo, photo de l'entreprise, titre, lieu, télétravail, contrat, fraîcheur, niveau, « pourquoi » en une ligne.
- Mise en avant douce des offres de moins de 48 h : postuler tôt compte.
- Actions sur chaque offre : **Sauvegarder**, **Pas pour moi** (+ raison en un clic, qui affine le scoring), **Postuler**.
- Postuler ouvre le site de l'offre dans un nouvel onglet. Au retour sur Scout : « Tu as postulé ? » → un clic l'ajoute au suivi.
- **Ajouter une offre par URL**, trouvée ailleurs : elle est analysée, scorée et ajoutée au suivi.
- **Outil « offre ratée »** : si une offre ajoutée par URL n'avait pas été collectée, le système explique pourquoi (source non couverte, règle d'exclusion, score trop bas) et propose le correctif. C'est l'outil principal pour mesurer et améliorer le rappel.
- Filtres simples (niveau, fraîcheur, contrat, télétravail) et vue « Écartées » pour auditer.

## Suivi des candidatures

- Kanban : À postuler → Postulé → Entretien → Offre → Refusé / Archivé.
- Par candidature : date, version du CV utilisée, contact, notes, prochaines étapes, dates d'entretien.
- Relances suggérées (J+7 par défaut), proposées sur l'écran Aujourd'hui, sans harcèlement.
- Récap hebdomadaire positif centré sur les actions (« 4 candidatures envoyées, 1 entretien obtenu »), pas sur les refus.

## Mon CV : analyse ATS

- Upload d'un CV en PDF → note sur 100 avec le détail par catégorie et, pour chaque point perdu, la raison et la correction concrète.
- Vue **« Ce que voit un ATS »** : le texte réellement extrait du PDF, affiché à côté du CV. Elle révèle les colonnes mélangées, les titres de section mal lus (lettres espacées), les textes en image, l'ordre de lecture cassé.
- Grille transparente :
  - **Lisibilité machine (40 pts)** : texte extractible, ordre de lecture, colonnes, polices, tableaux et images, coordonnées détectées (par regex côté serveur, jamais par le LLM), poids et nom du fichier.
  - **Structure (20 pts)** : sections standard identifiables, dates cohérentes, longueur.
  - **Contenu (25 pts)** : verbes d'action, résultats quantifiés, clarté.
  - **Adéquation (15 pts)** : mots-clés du métier visé dans le profil de l'utilisateur.
- Mode **« Comparer à une offre »** : score d'adéquation à une offre précise, mots-clés manquants, ajustements prioritaires.
- Historique des versions et progression de la note.
- Afficher honnêtement qu'il n'existe pas de score ATS universel : la note est celle de la grille Scout, indicative.

## Design et ambiance

- Ambiance de référence : Welcome to the Jungle (aéré, typographie éditoriale, cartes qui respirent) et le portfolio de l'auteur (inspiration Apple). S'en inspirer sans copier.
- **Direction retenue : C « Studio »** (maquettes dans `design/mockups/`), avec ces règles :
  - **Couleur calme** : la couleur de l'entreprise sert d'accent (fond très clair, bandeau, halo du logo), jamais en aplat saturé. Elle est éclaircie et désaturée automatiquement : fond de carte autour de 90-95 % de luminosité en mode clair.
  - La couleur est extraite du logo une fois, à la collecte, et stockée avec l'entreprise.
  - **Contraste vérifié automatiquement** (WCAG AA : 4,5:1 pour le texte, 3:1 pour les éléments graphiques) pour chaque carte, en mode clair et sombre. La couleur d'accent du texte est assombrie ou éclaircie jusqu'à passer le seuil.
  - Logo noir et blanc ou couleur introuvable : teinte neutre de repli.
  - Typographie expressive (Bricolage Grotesque) pour les titres uniquement ; texte courant et descriptions d'offres dans une sans-serif très lisible (Inter).
  - Détail d'une offre dans le panneau latéral.
- Processus : direction retenue → validation du fil à pleine densité (15 cartes, clair et sombre) et d'une fiche offre longue → design system formalisé → interface.
- Palette douce, beaucoup d'espace, coins arrondis, mode clair et sombre, micro-animations discrètes.
- Logos d'entreprise partout, via logo.dev ou Brandfetch. Pas de `logo.clearbit.com` (fermé).
- **Photos** : jamais sur les cartes du fil. Uniquement dans le panneau entreprise, et seulement si l'image de partage (og:image) passe les contrôles :
  - pas de texte posé par-dessus une image de partage ;
  - une image qui n'est qu'un logo est rejetée et remplacée par un visuel généré à partir de la couleur de l'entreprise.
  - **Jamais de carte vide ou grise.** Jamais d'images récupérées sur des plateformes tierces sans droit.
- Règles anti-stress :
  - pas de pastilles rouges ni de compteurs alarmants (« 247 nouvelles offres ! ») ;
  - pas de fausse urgence ;
  - pas de notifications intempestives ;
  - ton bienveillant ;
  - états vides encourageants ;
  - célébration discrète des actions (candidature envoyée) ;
  - refus présentés sobrement.
- Mode pause : suspend notifications et relances quand on a besoin de souffler.
- Notifications sobres : un message Telegram pour un Coup de cœur, sinon un digest quotidien (désactivable). Email optionnel.
- Responsive mobile, mais pensé d'abord pour un onglet ouvert en permanence sur ordinateur.

## Multi-utilisateurs, coûts et confidentialité

- Isolation stricte des données par utilisateur au niveau de la base (row-level security), pas seulement dans le code applicatif.
- Mutualisé : offres, annuaire d'entreprises, collecte.
- Privé : profil, CV, scores, feedback, suivi.
- Plafond d'appels LLM par utilisateur et par jour, suivi de la consommation du quota gratuit.
- Tableau de bord admin : utilisateurs, consommation, santé des sources.
- RGPD : suppression complète du compte et des données en un clic ; CV stockés de façon sécurisée ; aucune donnée personnelle dans le repo, dans les logs ni dans les requêtes LLM.
- Clés API en variables d'environnement (et secrets GitHub), jamais dans le code.

## Repo public

- Le repo est public (minutes GitHub Actions illimitées, projet vitrine). Avant le passage en public : scan de tout l'historique git avec gitleaks ; toute clé trouvée est révoquée et régénérée avant publication.
- Les logs GitHub Actions sont publics : ils ne contiennent ni email, ni contenu de profil ou de CV, ni score par utilisateur. Uniquement des compteurs agrégés par source.
- Aucun fichier personnel versionné (CV, `.env`, exports). Le `.gitignore` exclut `*.pdf`, `.env*` (sauf `.env.local.example`) et `/exports/`.
- Les maquettes et le compte de démo utilisent une persona fictive.

## Technique

- Front et API : Next.js (App Router, TypeScript, Tailwind) sur Vercel Hobby.
- Supabase : Postgres, Auth (Google), Storage (CV), row-level security.
- Workers de collecte et de scoring en TypeScript, lancés par GitHub Actions 2 à 3 fois par jour, qui écrivent dans la base. Ils réutilisent la normalisation des connecteurs existants.
- Jobs planifiés avec logs et reprise sur échec.
- Respect des limites de débit, pauses entre requêtes, pas de contournement des protections anti-bot.
- Tests : connecteurs (fixtures de réponses API), normalisation, dédup, scoring (6 cas de non-régression), extraction PDF de l'analyse CV.

## Vitrine (portfolio et entretiens)

- README : problème, vision, captures, schéma d'architecture, choix techniques et produit.
- Compte de démo public avec des données fictives (aucune donnée réelle d'utilisateur).
- Métriques affichables : offres collectées, sources couvertes, entreprises surveillées, taux de rappel mesuré via l'outil « offre ratée ».

## Ordre de réalisation

Découpage en tranches verticales : à la fin de chaque tranche, le site déployé fonctionne. Pas de correctif rapide sur le prototype actuel.

1. Audit de l'existant et plan validé. **Fait.**
2. Directions visuelles → choix → design system. Socle : comptes Google, profil en base, row-level security.
3. « Ma recherche » en langage naturel et onboarding.
4. Collecte large (ATS, France Travail, Adzuna, annuaire auto-enrichi) avec monitoring.
5. Normalisation, dédup, préfiltre permissif, scoring et niveaux, test de non-régression.
6. Interface monopage (Aujourd'hui, Offres, Suivi), panneau latéral, flux « Postuler → Tu as postulé ? ».
7. Ajout d'offre par URL, outil « offre ratée », feedback.
8. Onglet Entreprises, analyse CV ATS.
9. Ouverture aux amis (invitations, plafonds, admin).
10. Vitrine (README, démo).

Hors périmètre (v2) : extension « Ajouter à Scout », signaux de candidature spontanée, aide à la rédaction de messages.
