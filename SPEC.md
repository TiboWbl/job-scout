# Scout : spécification produit et technique

Dernière mise à jour : 5 octobre 2026.

## Vision

- **Un seul onglet ouvert pour gérer toute sa recherche d'emploi de A à Z.** Trouver les offres, les comprendre, postuler (redirection vers le site de l'offre), suivre ses candidatures, améliorer son CV. Tout part de Scout.
- **Scout complète WTTJ et LinkedIn**, qui restent les canaux principaux. Il doit :
  - faire remonter des offres qu'on n'aurait pas vues, surtout d'entreprises qu'on ne connaît pas ;
  - les trier selon le profil de chaque utilisateur, pour que personne n'ait à fouiller partout chaque jour ;
  - centraliser le suivi de toute la recherche, y compris les offres trouvées ailleurs (ajout par URL) ;
  - être agréable à utiliser au quotidien ;
  - être utilisable par des amis, chacun avec sa propre recherche ;
  - être visible sans compte par un recruteur venu du portfolio (mode démo), et présentable en entretien.
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
- **Aucun profil par défaut.** Aucune donnée propre à un utilisateur dans le code ; l'admin est désigné par la variable `ADMIN_EMAIL`.
- **Mock réservé aux tests.** Le mode mock du LLM sert uniquement aux tests automatisés, jamais à un vrai utilisateur. Si Mistral est indisponible : message clair et nouvel essai, jamais de résultat approximatif.
- **Les contraintes sont des portes**, jamais une moyenne de critères (voir « Préfiltre et scoring »).

## Infrastructure (gratuite)

| Besoin | Service | Limite à respecter |
|---|---|---|
| Front + API | Vercel Hobby, fonctions à Paris (`cdg1`, à côté de la base) | Usage non commercial ; pas de Vercel Cron (1/jour max) ; 60 s max par appel |
| Base, auth, stockage CV | Supabase Free | 500 Mo de base, 1 Go de stockage ; projet mis en pause après 7 jours sans activité (évité par la collecte planifiée) |
| Collecte et scoring planifiés | GitHub Actions, 2 à 3 fois par jour | Illimité si le repo est public ; 2 000 min/mois si privé |
| LLM | Mistral, plan gratuit | Sur ce plan, seuls les modèles `ministral` sont servis (`mistral-small`/`medium` limités à 0 requête, `mistral-large` exclu) : `ministral-14b-2512`, 30 requêtes/minute ; désactiver l'usage des données pour l'entraînement dans la console (Admin > Privacy) |
| Logos | logo.dev (plan Community) ou Brandfetch | 500 000 requêtes/mois ; pas d'attribution requise pour un projet personnel non commercial |
| Notifications | Bot Telegram ; email optionnel via SMTP Gmail (mot de passe d'application) | |

Rétention : les descriptions des offres archivées depuis plus de 60 jours sont purgées (titre, entreprise, dates et URL sont conservés) pour rester sous 500 Mo.

## Structure de l'application (une seule page)

- Application monopage avec une navigation persistante : **Aujourd'hui**, **Offres**, **Entreprises**, **Suivi**, **Mon CV**. « Ma recherche » s'ouvre en grand par-dessus Offres (bouton « Modifier ma recherche », la barre latérale reste visible) ; « Paramètres » depuis le menu du compte.
- Les détails (offre, entreprise, candidature) s'ouvrent dans un panneau latéral, sans quitter la page.
- **Aujourd'hui** (page d'accueil une fois connecté) : la sélection du jour, finie (pas de scroll infini), les relances à faire, les entretiens à venir, la progression de la semaine. En 30 secondes on sait quoi faire aujourd'hui.

## Comptes et onboarding

- Connexion **Google uniquement** (gratuit, aucun email à envoyer).
- **Accès sur invitation**, en place avant la mise en ligne : le site et le repo sont publics, le quota gratuit de Mistral doit être protégé.
  - Liste d'emails autorisés : variable `INVITED_EMAILS` (séparés par des virgules) et gestion dans la page Admin (table `invitations`). L'admin est toujours autorisé.
  - Un visiteur connecté mais non invité voit un message propre (« Scout est en accès sur invitation ») et ne peut appeler aucune route API.
  - Tant que l'application Google est en mode Test, l'adresse doit aussi figurer parmi les utilisateurs test de Google Cloud (100 maximum).
- Onboarding en moins de 5 minutes :
  - Upload du CV en PDF (recommandé, pas obligatoire). Les coordonnées sont retirées côté serveur avant tout envoi au LLM, qui en extrait l'expérience, les compétences, la séniorité réelle et les langues. **L'onboarding le dit clairement**, avec ce texte : « Ton nom et tes coordonnées ne sont jamais envoyés à l'IA. »
  - « Décris ce que tu cherches en quelques phrases » : texte libre.
  - Pendant l'analyse : un état de chargement explicite (« Scout lit ta recherche… »), jamais un écran figé.
  - « Tes entreprises de rêve » (facultatif) : quelques noms qui aident à cerner ce que la personne aime (secteur, taille, culture). Elles rejoignent les entreprises suivies.
  - L'onboarding rassure : le texte et le CV pourront être modifiés à tout moment depuis « Ma recherche ».
  - Le LLM transforme le tout en critères structurés. Les négations sont respectées (« Pas de stage ni d'alternance » exclut ces contrats).
  - Écran **« Ce que j'ai compris »** :
    - tout ce qui a été extrait est visible d'un coup d'œil (y compris langues, entreprises exclues, disponibilité), rien derrière « Plus de précisions » ;
    - pas de doublon entre le métier et les intitulés équivalents ;
    - une ligne « Depuis ton CV : … » (formation, expériences, compétences clés), qui prouve que le CV a été lu ;
    - le curseur d'ouverture est positionné d'après le texte quand il y a un indice, sinon au milieu ;
    - toutes les puces sont modifiables.
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
  - langues et disponibilité ;
  - entreprises à éviter ou à suivre ;
  - deal-breakers en texte libre.
- Zone : villes, régions ou pays, plus le télétravail accepté. Une offre « Remote US only » est hors zone. Le lieu d'une offre se lit aussi par sa région (en français ou en anglais) et son code postal, pour les villes peu connues ; une offre située seulement « France » est à vérifier. Réglage « Offres hors de ma zone » : **Jamais** (par défaut, écartées), **Seulement si exceptionnelles** (section séparée « Hors de ta zone », uniquement si tout le reste est excellent), **Oui**.
- Les mêmes critères restent modifiables directement par filtres, sans passer par le texte.
- Curseur d'ouverture : « job de rêve uniquement » ↔ « je veux surtout commencer quelque part ».
- Aperçu en direct de l'effet des critères (« ≈ X offres par semaine avec ces réglages »).
- Toute modification déclenche le re-scoring automatique des offres actives (profil versionné). Si les métiers, les lieux ou les contrats changent, une collecte complète démarre aussitôt sur GitHub Actions (jeton `GITHUB_DISPATCH_TOKEN`, limité au repo et aux Actions) ; la page Offres l'annonce jusqu'à son passage (environ quinze minutes). Le planning de GitHub étant parfois en retard ou sauté, ouvrir Offres plus de 8 h après la dernière collecte en lance une (au plus une toutes les 45 minutes par personne). « Ma recherche » utilise le même écran que l'onboarding : le texte de départ et le CV y restent modifiables, et tout ce que Scout a retenu du CV y est détaillé (expérience, postes, formation, réalisations, langues, compétences). Les entreprises favorites se gèrent dans l'onglet Entreprises (favorites qui recrutent pour la personne, autres entreprises qui recrutent pour elle, favorites sans offre en ce moment, sans doublon).
- **Mes entreprises favorites** (une seule notion pour « entreprises de rêve » et « entreprises suivies ») :
  - ajout en collant une entreprise par ligne ou séparées par des virgules, par URL de page carrière, ou par import CSV à deux colonnes `entreprise,site` (site facultatif), avec un modèle téléchargeable ;
  - pour chaque entrée : rapprochement avec l'annuaire, détection de l'ATS depuis l'URL, depuis la page carrière elle-même (lien ou intégration), ou en testant les adresses probables du nom ; la page trouvée est lue tout de suite ;
  - statut affiché par entreprise : « Page carrière trouvée » ou « Page carrière introuvable » ; progression visible pendant la recherche ;
  - ces entreprises sont surveillées à chaque collecte, leurs offres portent un badge « Favorite », l'IA en tient compte dans le score Intérêt, et elles rejoignent l'annuaire partagé. Elles ne restreignent jamais la recherche.

## Sources et découverte

- Connecteurs indépendants en **TypeScript** avec une interface commune (`fetch` → offres normalisées). L'échec d'un connecteur ne bloque jamais les autres.
- **Pages carrière via les API publiques des ATS** (brique prioritaire) :
  - Lever (`api.lever.co/v0/postings/{slug}?mode=json`)
  - Greenhouse (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`)
  - Ashby (`api.ashbyhq.com/posting-api/job-board/{slug}`)
  - Recruitee (`{slug}.recruitee.com/api/offers/`)
  - SmartRecruiters, Workable, Personio, Teamtailor.
  - Détection automatique de l'ATS à partir de l'URL de la page carrière ; repli sur un scraping simple de la page carrière de l'entreprise si aucun flux public n'existe.
- **Agrégateurs officiels** (facultatifs : sans clés, la source est ignorée) :
  - API France Travail (Offres d'emploi v2) : abandonnée le 7 octobre 2026, l'API n'apparaît plus dans le catalogue en libre-service de francetravail.io ; le connecteur est retiré ;
  - API Adzuna (branchée le 6 octobre 2026) : recherches croisant les intitulés de chaque profil avec son lieu, offres de moins de 60 jours, 8 recherches × 5 pages par collecte pour rester sous le quota gratuit (~250 appels/jour). Extraits de description seulement.
  - **Jooble** (branché, clé gratuite) : mêmes recherches, 3 pages. **Careerjet** (API d'affichage gratuite) : à brancher. Ces moteurs ne renvoient qu'un extrait de description : l'offre est scorée sur cet extrait et le lien mène à l'annonce complète.
- **La couverture est le levier n°1 de l'utilité de Scout.** Au 5 octobre 2026, seules 22 entreprises sont lues (environ 1 300 offres). Priorités, intégrées à la phase 2 :
  1. connecteurs pour 11 ATS à API ou flux publics (dont Workday, pour les grands groupes : liste paginée, détail seulement pour les intitulés utiles et les lieux recherchés) : Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Teamtailor (RSS, y compris sur le domaine de l'entreprise), Personio (XML), DigitalRecruiters (sites carrière de nombreuses entreprises françaises, dont Decathlon ; fiches détaillées lues seulement pour les intitulés recherchés ; photo propre à chaque annonce) et Welcome Kit (l'ATS de Welcome to the Jungle, lu par le widget public que les entreprises intègrent à leur propre page carrière ; la référence de l'entreprise se trouve sur son site carrière Welcome Kit) ; plus les **sites carrière propres** des entreprises sans ATS connu, lus par la fiche schema.org `JobPosting` de chaque offre (liens trouvés sur la page des offres, ou dans les plans du site déclarés par robots.txt quand la liste est dessinée par le navigateur, comme pour Orange ; l'adresse de chaque offre sert d'intitulé pour ne lire que les offres utiles), détectés automatiquement quand on ajoute une favorite ;
  - favorites sans page carrière lisible recherchées par leur nom sur Adzuna (25 au plus par collecte, une page chacune), en ne gardant que les offres publiées par cette entreprise ;
  2. découverte des pages carrière (`npm run discover`) : adresses vues dans l'index public de Common Crawl, et adresses devinées à partir des noms d'entreprises vus dans les offres des moteurs (« Acme Sport » → `acmesport`, `acme-sport` sur chaque ATS). Une entreprise n'entre dans l'annuaire que si sa page carrière publie au moins une offre dans la zone d'un profil ;
  3. Jooble, Adzuna et Careerjet (API v4, clé d'éditeur gratuite `CAREERJET_API_KEY`) branchés ; France Travail abandonné (son API d'offres n'est plus proposée en accès libre).
- **Pages carrière lues en rotation** : les moins récemment collectées d'abord, dans un budget de temps (le bouton admin tient dans un appel serverless ; la collecte planifiée lit tout). Une page qui répond 404 sort de la rotation. Santé des sources agrégée par ATS.
- **Filtre géographique à la collecte** : seules les offres situées dans un pays où un profil cherche (ou de lieu inconnu) sont stockées. Les autres ne servent à personne et la base gratuite est limitée à 500 Mo.
  - Requêtes générées à partir de toutes les variantes d'intitulés de tous les profils, avec pagination complète.
- Pas de LinkedIn, Indeed, Glassdoor, Google Jobs ni du site Welcome to the Jungle : aucun accès légal et gratuit. Seul le widget public Welcome Kit des entreprises est lu ; une entreprise présente uniquement sur le site WTTJ reste couverte par la recherche par nom sur les moteurs.
- **Annuaire d'entreprises partagé et auto-enrichi** :
  - Chaque entreprise vue dans une offre, quelle que soit la source, est ajoutée à l'annuaire. Sa page carrière et son ATS sont détectés, puis elle est surveillée en continu.
  - Import en masse possible (CSV, listes d'URL, annuaires sectoriels, incubateurs).
  - Fiche entreprise : logo, photo, description, secteur, taille, offres ouvertes, lien carrière.
- Onglet **Entreprises** : découvrir les entreprises qui correspondent à ma recherche, même sans offre ouverte, et les suivre.
- Collecte et tri 3 fois par jour via GitHub Actions (`.github/workflows/collect.yml`, 7 h, 13 h et 19 h à Paris) : collecte, puis tri des nouvelles offres pour chaque profil (`npm run score:all`) ; découverte de pages carrière le lundi matin ; lancement manuel possible. Le robot garde aussi le projet Supabase gratuit actif.
- Entretien de la base : archivage des offres retirées des pages carrière à chaque lecture, archivage des offres des moteurs non revues depuis 21 jours, purge des descriptions archivées depuis 60 jours ; taille de la base affichée dans l'admin face aux 500 Mo du plan gratuit.
- **Monitoring de santé par source** : offres par run, erreurs, alerte si une source tombe à zéro ou chute anormalement.

## Normalisation et déduplication

- Schéma commun : titre, entreprise, lieu (ville, pays), télétravail, contrat, XP demandée, salaire, langue, description complète, URL(s), source(s), date de publication, date de première détection.
- Toujours récupérer la description complète.
- Dédup cross-sources par entreprise + titre normalisé + similarité de description. Garder toutes les URLs et privilégier le lien direct entreprise pour postuler.
- Archiver les offres retirées. Ne jamais rejeter une offre pour un champ manquant.

## Préfiltre et scoring

- **Portes** par utilisateur, déterministes, appliquées dans cet ordre de lecture. Une offre qui en viole une est écartée (ou mise à part pour la zone), jamais compensée par le reste :
  1. **Zone**, avec la section « Hors de ta zone » selon le réglage.
  2. **Contrat.**
  3. **Séniorité**, relative à l'expérience de l'utilisateur (Senior, Lead, Head, Staff, Principal, Director, VP).
  4. **Écart d'expérience** entre l'expérience demandée et celle de l'utilisateur :
     - ≤ 2 ans : offre gardée, score Chances réduit en proportion ;
     - 3 ans : offre gardée, score Chances bas ;
     - ≥ 4 ans : offre écartée.
  5. **Secteurs et entreprises à éviter.**
- Retours de la personne réinjectés dans chaque jugement : offres sauvegardées ou postulées (appréciées), offres « Pas pour moi » avec leur raison (écartées).
- Expérience lue comme une fourchette (minimum, maximum) et affichée telle quelle (« 0 à 2 ans », « 3 à 6 ans », « 3 ans et plus »).
- Après les portes, seules les offres dont l'intitulé nomme un métier visé ou un intitulé équivalent (même en partie), ou une passerelle en entier, partent au LLM (« FP&A Analyst » ne passe pas pour « Product Analyst »), sauf celles des entreprises favorites, lues dès que leur description est connue ; chez une favorite, une offre lue sans intitulé proche peut être le métier visé, et n'est un Tremplin que dans un secteur prioritaire. Les autres sont écartées avec cette raison (consultable). Juger sur la description enverrait presque tout : « travailler avec les product managers » figure dans d'innombrables offres.
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
  - **Coup de cœur** : le métier visé, avec de vraies chances, dans un secteur prioritaire, chez une entreprise favorite, ou ouvert au niveau de la personne (junior, débutant accepté, pas plus d'années demandées que les siennes). Toujours à portée : 2 ans ou plus d'écart d'expérience = Solide au mieux. Un intitulé qui nomme le métier visé mot pour mot (« Healthcare Product Manager Junior ») est ce métier, sauf piège.
  - **Solide** : le métier visé, autre secteur, bonne entreprise.
  - **Tremplin** : une des passerelles de la personne ou un métier de la même famille, ou un poste au contact du produit et des utilisateurs dans un secteur prioritaire, avec un chemin crédible.
  - **Écartée** : avec raison, consultable.
- XP demandée supérieure à l'XP réelle : voir la porte « Écart d'expérience » ci-dessus.
- Le curseur d'ouverture pondère le classement entre Intérêt, Chances et Tremplin.
- Cache par couple (offre, version du profil). Chaque jugement du LLM porte une clé de ce dont il dépend (métiers, passerelles, secteurs, deal-breakers, contrats, langues, expérience, CV, favorites, version des règles) : une nouvelle version du profil qui ne change que la zone ou l'ouverture reprend les jugements et ne rejoue que les portes (9 000 offres en quelques secondes au lieu d'un quart d'heure). Les lignes des anciennes versions sont supprimées une fois le tri terminé.
- **LLM** : Mistral derrière une couche d'abstraction (changer de fournisseur = changer une variable d'environnement). `ministral-14b-2512` pour le scoring comme pour l'analyse de CV et la conversion des critères (modèles réglables par variables d'environnement). File d'attente à une requête toutes les 2,1 s (30/minute) avec nouvel essai sur 429. **Scoring par lots de 8 offres par requête.**
- Premier tri : progression visible (« 1 190 / 1 249 »), la sélection se remplit au fur et à mesure. Le premier appel n'applique que les portes (instantané) ; les suivants envoient les lots au LLM en parallèle, un départ toutes les 2,1 s, et rendent la main avant 52 s quoi qu'il arrive. Les coupures sont reprises automatiquement.
- Fiabilité des faits affichés : l'expérience demandée, le contrat et le salaire sont lus d'abord par un détecteur déterministe. Pour l'expérience : toute durée en années (seule, en fourchette « 4 à 8 ans », « 8–12 years », « 5/6 ans », plancher « > 5 ans », « au moins », plafond « jusqu'à 2 ans ») proche d'un mot d'expérience, sauf si elle décrit l'entreprise (« nos 50 ans d'expérience »), un contrat, une prime d'ancienneté ou des études ; la première exigence énoncée l'emporte. Pour le salaire : un montant annuel ou mensuel plausible à côté d'un mot de rémunération, jamais une levée, un chiffre d'affaires ou un budget ; pour le contrat : un contrat annoncé n'importe où dans le texte (« Contrat : CDI », « … en stage »), jamais une mention de parcours (« stage ou alternance acceptés ») ; pour le télétravail : la description quand le lieu ne dit rien (« télétravail jusqu'à 3 jours », « hybrid work, 2 days of remote », « full remote »), jamais des « rituels hybrides » ; le LLM ne peut les compléter qu'en citant la phrase exacte de l'offre, vérifiée mot pour mot. Une expérience ou un contrat ainsi trouvé passe par les mêmes portes. Sans nombre d'années, les mots de l'offre comptent : « profil junior », « première expérience », « peu expérimenté » la rendent accessible à un junior (Coup de cœur possible) ; « expérience significative », « solide expérience », « profil confirmé » comptent comme 3 ans pour l'écart (jamais affichés comme un nombre : la carte dit « Expérience significative demandée » ou « Profil junior accepté »). Un salaire n'est affiché que s'il est écrit. Jamais d'information inventée.
- Le LLM répond à des questions factuelles (métier réel, secteur, piège, deal-breaker) ; le niveau en est déduit par une règle fixe. Un secteur à éviter ou un deal-breaker n'écarte une offre que si le LLM recopie l'élément exact de la personne qu'elle heurte et la phrase de l'offre qui le prouve (vérifiée mot pour mot, et qui nomme le sujet de l'élément : « jeu vidéo » exige « jeu » ou « vidéo ») ; un deal-breaker négatif (« postes sans orientation discovery ») ne peut pas se prouver par une phrase : il devient un point d'attention, jamais une exclusion ; le secteur, le type de clients ou la technologie ne sont jamais un piège (un « piège » qui ne parle que du secteur devient un point d'attention) ; un secteur simplement non prioritaire n'écarte jamais. Le domaine du produit (cloud, IA…) ne change pas le métier. Une offre écartée affiche une raison de 12 mots au plus.
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
    8. Junior PM dans une scale-up ameublement/déco financée, vrai poste produit digital, 0 à 2 ans demandés : **Coup de cœur** (ouvert aux juniors).
    9. « Junior Product Manager » dans une marque de mode, en réalité développement de collection textile : **Écartée**.
    10. QA Analyst dans un cabinet de conseil produit, passerelle annoncée QA → PO → PM : **Tremplin**.
    11. Customer Experience Specialist chez un fabricant d'objets connectés santé : **Tremplin**, score bas.
  - Extraction des critères :
    12. Texte d'onboarding anonymisé d'un PM junior (ingénieur diplômé en 2024, ~1 an de stages, Paris/IDF hybride ou full remote depuis la France, étranger seulement si exceptionnel, secteurs sport/sport-santé/santé grand public, pas de paris sportifs, jeu vidéo ni produit non digital, pas de stage ni d'alternance, anglais courant, ancien employeur fictif exclu, disponible immédiatement). Le test échoue si une négation est inversée (stage ou alternance cochés, secteur évité rangé en prioritaire) ou si le métier est dupliqué dans les intitulés équivalents.

## Offres (fil)

- **Sélection du jour finie et curée**, pas un scroll infini. Classement par niveau puis score.
- Cartes : ce qu'on cherche d'un coup d'œil quand on parcourt une offre :
  - logo, titre, entreprise, niveau, fraîcheur (« publiée il y a X jours ») ;
  - lieu, télétravail, contrat, **salaire** s'il est indiqué ;
  - **expérience demandée**, lue dans « Profil recherché » ou équivalent (ex. « 3 ans et plus ») ;
  - **2 à 3 missions principales**, en quelques mots chacune ;
  - le « pourquoi » en entier (une phrase courte), pas tronqué.
  Points forts, points d'attention et leviers CV dans le panneau latéral.
- Détail d'une offre : un bloc « L'entreprise » dit ce qu'elle fait concrètement (son produit ou service et pour qui, une phrase factuelle lue dans ses offres par le LLM, jamais un slogan), sinon l'introduction de l'offre. Panneau latéral par défaut, avec une option « plein écran » qui occupe toute la zone de contenu en gardant la barre latérale.
- Logos : par domaine quand il est connu, sinon recherche par nom (logo.dev) ; initiales en repli quand la marque n'est pas reconnue avec certitude.
- Mise en avant douce des offres de moins de 48 h : postuler tôt compte.
- Seules les offres connues uniquement par les moteurs (Adzuna, Jooble) et publiées il y a plus de 60 jours sont masquées par défaut : une offre encore listée sur la page carrière de l'entreprise est ouverte, quelle que soit sa date (une offre retirée de la page est archivée).
- Actions sur chaque offre : **Sauvegarder**, **Pas pour moi** (+ raison en un clic, qui affine le scoring), **Postuler**.
- Postuler ouvre le site de l'offre dans un nouvel onglet. Au retour sur Scout : « Tu as postulé ? » → un clic l'ajoute au suivi.
- **Ajouter une offre par URL**, trouvée ailleurs (WTTJ, LinkedIn…), depuis le Suivi, avec repli « coller le texte » si la page est inaccessible. Lecture par le connecteur ATS si l'adresse en vient, sinon par la fiche schema.org `JobPosting` de la page, sinon par le LLM sur le texte. Elle est jugée pour la personne et ajoutée au suivi (« À postuler » ou « Postulé ») : tout le suivi vit dans Scout.
  - Diagnostic à chaque ajout : « déjà trouvée par Scout le … », « trouvée mais écartée : règle … » ou « nouvelle pour Scout ».
  - Entreprise inconnue : recherche de sa page carrière, détection de l'ATS, ajout à l'annuaire.
- **Outil « offre ratée »** : si une offre ajoutée par URL n'avait pas été collectée, le système explique pourquoi (source non couverte, règle d'exclusion, score trop bas) et propose le correctif. C'est l'outil principal pour mesurer et améliorer le rappel.
- Filtres : un sélecteur de niveau à choix unique (Toutes, Coups de cœur, Solides, Tremplins) avec le nombre d'offres et une phrase qui explique le niveau choisi ; des cases combinables (Junior : 2 ans demandés au plus ou annoncée junior, Moins de 48 h, Inclure les +60 jours) ; une recherche par entreprise ou intitulé, qui affiche aussi, sous les résultats, les offres hors de la zone et les offres écartées qui correspondent (lues côté serveur), chacune avec sa raison : une entreprise trouvée par Scout n'a jamais l'air absente ; une offre située seulement « France » est « lieu à vérifier », jamais hors zone ; un bouton « Voir les écartées » qui ouvre la vue d'audit, où chaque offre affiche la règle qui l'a écartée.
- Actions secondaires : toujours de vrais boutons, jamais du texte souligné.
- « Pas pour moi » : une raison en un clic, stockée, puis réinjectée dans le scoring.

## Suivi des candidatures

- Kanban : À postuler → Postulé → Entretien → Offre → Refusé / Archivé. Les cartes se déplacent par glisser-déposer (le menu d'étape de chaque carte fait de même au toucher et au clavier) ; passer une carte en « Postulé » sans date lui donne la date du jour.
- « Ta progression » : candidatures envoyées, entretiens, taux de réponse (entretien, offre ou refus) et candidatures de la semaine, plus un graphique des 8 dernières semaines.
- Par candidature : date de candidature, contact, notes, date d'entretien, origine (repérée par Scout ou ajoutée). Version du CV utilisée plus tard.
- Relance suggérée 7 jours après la candidature, puis 7 jours après la dernière relance (« Une relance peut aider », bouton « J'ai relancé »), sur la carte et sur l'écran Aujourd'hui, sans harcèlement.
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
- Fonctionnement : le PDF est lu dans le navigateur (texte dans l'ordre de lecture, colonnes et titres en lettres espacées détectés par la position des mots) ; la grille est calculée par des règles fixes côté serveur. Le LLM, sur le texte sans nom ni coordonnées, propose seulement les mots-clés du métier (leur présence est vérifiée dans le texte) et jusqu'à trois lignes à renforcer (citées mot pour mot, sans chiffre inventé : « [chiffre] »). En comparaison, les mots-clés de l'offre ne comptent que s'ils sont écrits dans l'offre. Chaque analyse est gardée pour être relue (nom du fichier, grille, corrections, lignes réécrites, comparaison), jamais le CV entier, et peut être supprimée. Les mots-clés du métier sont fixés une fois par ensemble de métiers visés : le même CV obtient toujours la même note. Une correction s'accompagne de son « pourquoi », et « Ce qui fonctionne déjà » explique pourquoi les points obtenus aident face à un ATS ou un recruteur ; tout est présenté comme des recommandations, jamais des obligations. Un mot-clé à barre (« Agile/Scrum ») est une alternative, et le pluriel compte. Un bouton « Adapter mon CV » dans le détail d'une offre ouvre la comparaison.

## Design et ambiance

- Ambiance de référence : Welcome to the Jungle (aéré, typographie éditoriale, cartes qui respirent) et le portfolio de l'auteur (inspiration Apple). S'en inspirer sans copier.
- **Direction retenue : C « Studio »** (maquettes dans `design/mockups/`), avec ces règles :
  - **Couleur calme** : la couleur de l'entreprise sert d'accent (fond très clair, bandeau, halo du logo), jamais en aplat saturé. Elle est éclaircie et désaturée automatiquement : fond de carte autour de 93 % de luminosité en mode clair, bordure dans la couleur de l'entreprise (couleurs assumées, jamais d'aplat saturé).
  - La couleur est extraite du logo une fois, à la collecte, et stockée avec l'entreprise.
  - **Contraste vérifié automatiquement** (WCAG AA : 4,5:1 pour le texte, 3:1 pour les éléments graphiques) pour chaque carte, en mode clair et sombre. La couleur d'accent du texte est assombrie ou éclaircie jusqu'à passer le seuil.
  - Logo noir et blanc ou couleur introuvable : teinte neutre de repli.
  - Typographie expressive (Bricolage Grotesque) pour les titres uniquement ; texte courant et descriptions d'offres dans une sans-serif très lisible (Inter).
  - Détail d'une offre dans le panneau latéral.
- Processus : direction retenue → validation du fil à pleine densité (15 cartes, clair et sombre) et d'une fiche offre longue → design system formalisé → interface.
- Palette douce, beaucoup d'espace, coins arrondis, mode clair et sombre, micro-animations discrètes.
- Logos d'entreprise partout, via logo.dev ou Brandfetch. Pas de `logo.clearbit.com` (fermé).
- **Photos** (demande de l'utilisateur : plus vivant, plus humain) : l'image de partage (og:image) du site de l'entreprise, référencée par URL et jamais copiée, en haut des cartes du fil et dans le bandeau du panneau, seulement si elle passe les contrôles (assez grande, format paysage, pas un logo sur fond uni) :
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
- **Logo** (généré par `npm run brand`, fichiers dans `public/brand` et `public/icons`) : « Scout. » de la maquette C (texte blanc ou noir, point violet), vectorisé en SVG avec le texte converti en tracés. Déclinaison « S. » (S majuscule et point violet) pour les icônes : favicon 16 et 32, apple-touch-icon 180, icônes 192 et 512, versions claire et sombre. Aux petites tailles, le point est proportionnellement plus gros pour rester visible. Image de partage 1200 × 630 et un PNG 512 du « S. » pour le portfolio.

## Multi-utilisateurs, coûts et confidentialité

- Isolation stricte des données par utilisateur au niveau de la base (row-level security), pas seulement dans le code applicatif.
- Mutualisé : offres, annuaire d'entreprises, collecte.
- Privé : profil, CV, scores, feedback, suivi.
- Plafond d'appels LLM par utilisateur et par jour, suivi de la consommation du quota gratuit.
- **Espace admin** (compte désigné par `ADMIN_EMAIL`), accessible depuis le menu du compte en bas de la barre latérale :
  - invitations : ajouter ou retirer une adresse, et voir pour chaque invité s'il s'est déjà connecté (et quand) ;
  - tableau de bord sobre, avec graphiques, utile pour suivre le produit et le présenter en entretien : offres actives et nouvelles par jour, entreprises dans l'annuaire et leur origine, sources et leur santé, utilisateurs actifs, offres triées par l'IA, répartition des niveaux, candidatures suivies (agrégées, jamais nominatives).
- **Barre latérale** : en bas, la photo du compte Google et le prénom ; un clic ouvre un petit menu (Admin pour l'admin, Se déconnecter).
- **Jamais d'attente muette** : toute opération en arrière-plan (analyse, tri, ajout, collecte, import) montre une progression ou un indicateur de chargement.
- RGPD : page publique « Confidentialité » (`/confidentialite` : données gardées, usage de Mistral sans nom ni coordonnées, sous-traitants, cookie unique, droits ; contact par la variable facultative `CONTACT_EMAIL`) et suppression complète du compte en deux clics dans « Paramètres » (menu du compte, avec le thème Automatique, Clair ou Sombre gardé sur l'appareil) (l'utilisateur est supprimé et tout ce qui lui est rattaché suit en cascade ; l'invitation reste valable, l'admin peut la retirer). Nécessaire pour les CV d'amis et pour la vérification de marque Google. Le texte du CV n'est pas conservé ; aucune donnée personnelle dans le repo, dans les logs ni dans les requêtes LLM.
- Clés API en variables d'environnement (et secrets GitHub), jamais dans le code.

## Repo public

- Le repo est public (minutes GitHub Actions illimitées, projet vitrine). Avant le passage en public : scan de tout l'historique git avec gitleaks ; toute clé trouvée est révoquée et régénérée avant publication.
- Les logs GitHub Actions sont publics : ils ne contiennent ni email, ni contenu de profil ou de CV, ni score par utilisateur. Uniquement des compteurs agrégés par source.
- Aucun fichier personnel versionné (CV, `.env`, exports). Le `.gitignore` exclut `*.pdf`, `.env*` (sauf `.env.local.example`) et `/exports/`.
- Les maquettes et le compte de démo utilisent une persona fictive. Les cas de test tirés de vrais textes sont anonymisés.

## Technique

- Front et API : Next.js (App Router, TypeScript, Tailwind) sur Vercel Hobby.
- Supabase : Postgres, Auth (Google), Storage (CV), row-level security.
- Workers de collecte et de scoring en TypeScript, lancés par GitHub Actions 2 à 3 fois par jour, qui écrivent dans la base. Ils réutilisent la normalisation des connecteurs existants.
- Jobs planifiés avec logs et reprise sur échec.
- Respect des limites de débit, pauses entre requêtes, pas de contournement des protections anti-bot.
- Tests : connecteurs (fixtures de réponses API), normalisation, dédup, scoring et extraction des critères (12 cas de non-régression), extraction PDF de l'analyse CV.

## Vitrine (portfolio et entretiens)

- README : problème, vision, captures, schéma d'architecture, choix techniques et produit, lien vers la démo.
- **Page d'accueil publique** (visiteur non connecté, sur `/`) : ce que fait Scout en une phrase, trois vraies offres triées pour la persona de démo avec leur « Pour toi », trois chiffres réels (offres lues, pages carrière surveillées, chaque offre expliquée), et deux boutons « Voir la démo » et « Continuer avec Google » (sur invitation).
- **Mode démo sans connexion**, lien direct `/demo` :
  - persona fictive (Camille, PM junior à Paris) scorée comme un vrai utilisateur sur les **vraies offres** en base : la démo montre le produit réel, pas des captures ;
  - jamais le compte de l'auteur ni ses vraies candidatures ;
  - suivi pré-rempli avec des candidatures fictives ;
  - lecture seule côté serveur : aucun appel au LLM déclenché par un visiteur (le scoring de la persona est calculé par le cron), les clics marchent dans la session sans être enregistrés, ajout par URL et import désactivés avec une explication ;
  - bandeau discret : « Démo avec un profil fictif · Données d'offres réelles », bouton « Quitter la démo ».
  - Mise en œuvre : Camille est un profil marqué `is_demo` (adresse inutilisable, aucune connexion possible), exclu des requêtes de collecte et des statistiques. `npm run demo:seed`, lancé par le robot après chaque tri, la crée si besoin, trie ses offres, choisit ses favorites et reconstruit un suivi fictif sur des offres encore ouvertes, avec des dates relatives au jour. Les pages `/demo` lisent ses données avec le rôle de service ; deux API publiques en lecture seule servent les descriptions et les écartées.
- **Pas de page d'explication dans le site** : le projet est expliqué dans le portfolio de l'auteur. C'est l'UX elle-même qui doit rendre évident, pour un utilisateur comme pour un recruteur, comment Scout fonctionne et ce qu'il permet de faire qu'on ne peut pas faire ailleurs :
  - chaque offre montre d'où elle vient, pourquoi elle est proposée et à quel niveau ;
  - les offres écartées restent consultables avec la règle qui les a écartées ;
  - le profil compris par Scout est visible et modifiable ;
  - le suivi rassemble aussi les offres trouvées ailleurs.
- Métriques affichables : offres collectées, sources couvertes, entreprises surveillées, taux de rappel mesuré via l'outil « offre ratée ».

## Ordre de réalisation

Découpage en phases : à la fin de chacune, tests verts, commit + push, site testable en local et sur Vercel.

0. **Mise en ligne sur Vercel**, avec l'accès sur invitation en place avant que l'URL soit publique.
1. **Onboarding fiable avec Mistral** : extraction des critères (négations, doublons), écran « Ce que j'ai compris », état de chargement, cas de non-régression au vert.
2. **Couverture et pertinence** : nouveaux connecteurs ATS, découverte massive des pages carrière, Jooble et Careerjet ; scoring Mistral réel avec progression, portes dans l'ordre, fraîcheur, vue « Écartées » avec la règle.
3. **Aujourd'hui, Suivi, personnalisation, logo** : écran Aujourd'hui, suivi enrichi (notes, contact, relance J+7), ajout d'offre par URL avec diagnostic, entreprises suivies, logo et icônes.
4. **Automatisation et conformité** : cron GitHub Actions (collecte puis scoring des nouvelles offres), page Confidentialité, suppression du compte, archivage et purge.
5. **Mode démo et page d'accueil publique.**

### V2 : une version très améliorée, presque définitive

Priorité absolue : la pertinence des offres proposées et ne rater aucune offre importante, surtout chez les entreprises favorites. Le reste est un bonus. Mêmes règles que la V1 : phases testables, arrêt en fin de phase.

1. **V2.1 Pertinence et couverture**
   - Expérience lue comme une fourchette (« jusqu'à 2 ans » = 0 à 2 ans ; « 3-6 ans » = 3 à 6 ans), affichée telle quelle.
   - Coup de cœur réservé aux offres à portée : écart d'expérience de 2 ans ou plus = Solide au mieux, jamais Coup de cœur (un junior ne perd pas son temps sur des offres hors d'atteinte présentées comme idéales).
   - Retours sur chaque offre (« Ça me plaît », « Pas pour moi » + raison) réinjectés dans le jugement des offres suivantes.
   - Aucune offre ratée chez les favorites : connecteurs DigitalRecruiters (Decathlon et de nombreuses entreprises françaises) et Welcome Kit, recherche des favorites sans page carrière lisible par leur nom sur les moteurs, offres des favorites jugées sans pré-tri par intitulé.
   - Descriptions lisibles : texte brut restructuré en sections et listes.
   - Doublons d'entreprise (« Robeaute » / « Robeaute-1 »).
2. **V2.2 Vitesse** (faite) : onglets de la barre latérale chargés en arrière-plan et onglets visités gardés 30 s dans le navigateur (rafraîchis après chaque action), cartes des offres dessinées par 24 au fil du défilement (page Offres de 638 à 300 Ko), vérifications d'accès en parallèle à chaque page.
3. **V2.3 Simplicité et finitions** (faite) : photos aussi tirées de la page de l'offre et de la page carrière, site des employeurs connus par leur seul nom deviné puis confirmé par le LLM face à leurs offres (jamais de logo ou de photo d'une autre entreprise), offres écartées en cartes avec une étiquette de raison (Contrat, Expérience, Lieu, Métier éloigné, Secteur, Contenu du poste, Ton choix), critères de Ma recherche en blocs colorés (clair et sombre), filtre « Écartées » parmi les filtres, recherche alignée au pixel sur les filtres, couleurs plus marquées, plus de photos, titre d'onglet par page, « Ma recherche » allégée (moins de texte, favorites compactes, pleine largeur), critères modifiables depuis Offres, étoile pour les favorites, plus de page /login ni de « Se connecter » (la page d'accueil suffit), déconnexion vers l'accueil, bannière de démo « rien n'est enregistré », lien Confidentialité de l'accueil, passe sur tout le site pour retirer le superflu.
4. **V2.4 Suivi et Paramètres** (faite) : cartes déplaçables par glisser-déposer, graphiques (candidatures, entretiens, taux de réponse, par semaine), page Paramètres depuis le menu du compte (mode clair ou sombre, suppression du compte), bouton du compte encadré.
5. **V2.5 CV** (faite) : analyse ATS sur 100 avec recommandations et comparaison à une offre.
6. **V2.6** (faite) : onglet **Entreprises** (favorites avec leurs offres pour la personne et ce qu'elles font, puis les entreprises qui recrutent pour elle, chacune ouvrant ses offres dans Offres) ; doublons entre sources (une offre vue seulement sur un moteur disparaît quand l'entreprise publie la même sur sa page carrière, intitulés comparés sans H/F, contrat ni ville) ; README vitrine.
7. **Après la V3, selon les retours d'usage réel** : notifications (Telegram pour un Coup de cœur, digest quotidien désactivable) ;  vérification de marque Google.

Hors périmètre (v2) : extension « Ajouter à Scout », signaux de candidature spontanée, aide à la rédaction de messages.
