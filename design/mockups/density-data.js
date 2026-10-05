// Maquette pleine densité : entreprises réelles, offres fictives, persona fictive (Camille, PM junior).
// Couleurs volontairement variées : plusieurs bleus, un rouge, des logos noir et blanc.

const DENSE_OFFERS = [
  { company: "Doctolib", domain: "doctolib.fr", title: "Associate Product Manager, Parcours patient", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 5 h", isNew: true, level: "coeur", why: "Healthtech, mentorat structuré et profil junior explicitement recherché." },
  { company: "Qonto", domain: "qonto.com", title: "Product Manager, Onboarding PME", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 9 h", isNew: true, level: "coeur", why: "Le métier que tu vises, 0 à 2 ans d'expérience demandés." },
  { company: "BlaBlaCar", domain: "blablacar.com", title: "Junior Product Manager, Covoiturage", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Hier", isNew: true, level: "coeur", why: "Beaucoup de discovery et d'interviews utilisateurs, ton point fort." },
  { company: "Swile", domain: "swile.co", title: "Associate Product Manager, Avantages salariés", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 2 jours", isNew: false, level: "coeur", why: "Poste d'entrée encadré par un Lead PM, équipe produit de 40 personnes." },
  { company: "Alan", domain: "alan.com", title: "Product Owner, Parcours membres", location: "Paris", remote: "Télétravail possible", contract: "CDI", freshness: "Il y a 2 jours", isNew: false, level: "solide", why: "Santé, ton secteur prioritaire, mais 2 ans d'expérience demandés." },
  { company: "Malt", domain: "malt.fr", title: "Chef de produit junior, Matching", location: "Paris", remote: "Remote partiel", contract: "CDI", freshness: "Il y a 3 jours", isNew: false, level: "solide", why: "Intitulé différent, missions de PM : roadmap, specs, discovery." },
  { company: "Contentsquare", domain: "contentsquare.com", title: "Product Owner, Data Platform", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 3 jours", isNew: false, level: "solide", why: "Poste technique, un atout avec ton profil ingénieur." },
  { company: "PayFit", domain: "payfit.com", title: "Product Manager, Paie", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 4 jours", isNew: false, level: "solide", why: "Vrai poste produit, hors de tes secteurs prioritaires." },
  { company: "Dataiku", domain: "dataiku.com", title: "Associate Product Manager, Collaboration", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 4 jours", isNew: false, level: "solide", why: "Programme APM avec rotations entre équipes." },
  { company: "Lydia", domain: "lydia-app.com", title: "Product Manager junior, Paiements", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 5 jours", isNew: false, level: "solide", why: "App grand public utilisée par des millions de personnes." },
  { company: "Spendesk", domain: "spendesk.com", title: "Product Owner, Cartes", location: "Paris", remote: "Remote", contract: "CDI", freshness: "Il y a 5 jours", isNew: false, level: "solide", why: "Full remote possible, équipe produit anglophone." },
  { company: "Pennylane", domain: "pennylane.com", title: "Product Analyst", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 6 jours", isNew: false, level: "tremplin", why: "Passerelle vers PM : travail quotidien avec les squads produit." },
  { company: "Aircall", domain: "aircall.io", title: "Product Operations Specialist", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 6 jours", isNew: false, level: "tremplin", why: "Mobilité interne vers le produit affichée dans l'offre." },
  { company: "Back Market", domain: "backmarket.com", title: "Business Analyst, Catalogue", location: "Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 1 semaine", isNew: false, level: "tremplin", why: "Proche des équipes produit catalogue, chemin crédible vers PO." },
  { company: "Agicap", domain: "agicap.com", title: "Customer Success Manager, Produit", location: "Lyon ou Paris", remote: "Hybride", contract: "CDI", freshness: "Il y a 1 semaine", isNew: false, level: "tremplin", why: "Remontée des besoins clients vers le produit, score plus bas." },
];

const DETAIL = {
  index: 0,
  experience: "0 à 2 ans",
  salary: "42 – 48 k€",
  why: "Healthtech, ton secteur prioritaire. Le profil recherché (formation ingénieur, première expérience produit, goût pour la recherche utilisateur) correspond presque point par point à ton parcours.",
  strengths: ["Secteur santé, ta priorité n°1", "Mentorat structuré avec un PM senior", "Profil ingénieur explicitement demandé"],
  watch: ["Anglais courant requis en entretien", "Poste à Paris, 3 jours sur site"],
  cvLevers: ["Reprendre l'intitulé « Associate Product Manager » dans ton titre de CV", "Mettre en avant tes interviews utilisateurs en premier"],
  sections: [
    { title: "L'équipe", paragraphs: [
      "Tu rejoins l'équipe Parcours patient, qui conçoit tout ce qu'un patient vit entre la prise de rendez-vous et la fin de sa consultation : rappels, préparation de la consultation, documents, messages avec le praticien.",
      "L'équipe compte une Product Manager senior, un Product Designer, une UX Researcher et huit développeurs. Elle livre en continu et mesure chaque changement avec des tests A/B.",
    ] },
    { title: "Tes missions", bullets: [
      "Comprendre les besoins des patients avec la UX Researcher : interviews, tests utilisateurs, analyse des retours du support.",
      "Rédiger les spécifications fonctionnelles et les user stories avec les développeurs.",
      "Prioriser le backlog de ton périmètre avec ta Product Manager référente.",
      "Suivre les indicateurs de ton périmètre et proposer des améliorations.",
      "Présenter les avancées de l'équipe lors des revues produit mensuelles.",
      "Participer au programme de mentorat Associate PM : un binôme senior, un point hebdomadaire, un plan de progression sur 12 mois.",
    ] },
    { title: "Profil recherché", bullets: [
      "Formation d'ingénieur ou équivalent.",
      "Une première expérience produit (stage, alternance ou premier emploi), de 0 à 2 ans.",
      "Goût pour la recherche utilisateur et à l'aise avec la donnée (SQL apprécié).",
      "Capacité à écrire de manière claire et structurée.",
      "Anglais courant, une partie de l'équipe est internationale.",
      "Une sensibilité aux enjeux de santé est un vrai plus.",
    ] },
    { title: "Ce que l'équipe propose", bullets: [
      "Télétravail deux jours par semaine.",
      "Budget formation annuel et accès aux conférences produit.",
      "Mutuelle prise en charge à 100 %.",
    ] },
    { title: "Déroulé du recrutement", bullets: [
      "Échange de 30 minutes avec la recrutrice.",
      "Entretien avec ta future Product Manager référente.",
      "Étude de cas produit à préparer (2 heures maximum).",
      "Rencontre avec l'équipe.",
    ] },
  ],
};
