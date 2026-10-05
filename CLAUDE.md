@AGENTS.md

# Scout : règles permanentes

La source de vérité produit et technique est [SPEC.md](SPEC.md). Les décisions nouvelles y sont intégrées dans le texte, jamais en annexe.

## Règles

- **100 % gratuit** : aucun service payant, aucune carte bancaire. Si une fonctionnalité en exige un, le signaler avant de la construire.
- **Aucun profil par défaut** et aucune donnée propre à un utilisateur dans le code. L'admin est désigné par `ADMIN_EMAIL`, les requêtes de collecte viennent des profils en base.
- **Mock réservé aux tests.** Le mode mock du LLM sert uniquement aux tests automatisés, jamais à un vrai utilisateur. Si Mistral est indisponible : message clair et nouvel essai, jamais de résultat approximatif.
- **Repo public : aucune donnée personnelle** dans le code, les fixtures de test, les commits ou les logs GitHub Actions (uniquement des compteurs agrégés par source). Les cas de test tirés de vrais textes sont anonymisés. Aucun fichier personnel versionné (CV, `.env`, exports).
- **Coordonnées retirées** (nom, email, téléphone, adresse) avant tout envoi au LLM.
- **Les contraintes sont des portes**, jamais une moyenne de critères.
- **Rien de superflu à l'écran** : chaque élément doit aider à décider ou à agir.
- **Clés uniquement en variables d'environnement** (`.env.local`, Vercel, secrets GitHub). Ne jamais afficher une clé en clair, même dans un log local : seulement des valeurs masquées.
- **Chaque phase est testable en local et sur Vercel.**

## Façon de travailler

- Travail par phases. À la fin de chaque phase : tests verts (`npm test`, `npm run lint`, `npm run build`), commit + push sur `main` (Vercel redéploie), puis s'arrêter et donner :
  - ce qui a été fait ;
  - ce que l'utilisateur doit tester, en étapes précises ;
  - ce qui reste.
- Un commit par étape fonctionnelle. Le repo est public : chaque push est visible immédiatement.
- Textes de l'interface en français, ton bienveillant, sans tiret cadratin.
- Migrations SQL dans `supabase/migrations/`, appliquées avec `npm run db:migrate`.
