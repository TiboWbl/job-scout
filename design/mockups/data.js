// Données de maquette : entreprises réelles, offres fictives. Aucune donnée d'utilisateur réel.
// Les logos passent ici par unavatar.io ; en production ce sera logo.dev.

const LEVELS = {
  coeur: { label: "Coup de cœur" },
  solide: { label: "Solide" },
  tremplin: { label: "Tremplin" },
};

const OFFERS = [
  {
    company: "Qonto",
    domain: "qonto.com",
    color: "#5B4BDB",
    photo: "https://qonto.com/blog/images/asset/32776/image/52a051963b267b2b99a01ea505524633.avif",
    title: "Product Manager, Onboarding PME",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Il y a 6 h",
    isNew: true,
    level: "coeur",
    why: "Le métier que tu vises, en fintech B2B, pour un profil de 0 à 2 ans d'expérience.",
  },
  {
    company: "Swile",
    domain: "swile.co",
    color: "#F2545B",
    photo: "https://public-files.swile.co/marketing-website/images/pages/home/meta.png",
    title: "Associate Product Manager, Avantages salariés",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Hier",
    isNew: true,
    level: "coeur",
    why: "Poste pensé pour un premier job produit, encadré par un Lead PM.",
  },
  {
    company: "BlaBlaCar",
    domain: "blablacar.com",
    color: "#0E7FB8",
    photo: null,
    title: "Junior Product Manager, Covoiturage",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Il y a 2 jours",
    isNew: false,
    level: "coeur",
    why: "Marketplace grand public et beaucoup de discovery, proche de ton alternance en product.",
  },
  {
    company: "Alan",
    domain: "alan.com",
    color: "#4F6BED",
    photo: "https://images.prismic.io/alan-health/k7194HdRbSpaaBlI_Socialsharepreview-FR.png",
    title: "Product Owner, Parcours membres",
    location: "Paris",
    remote: "Télétravail possible",
    contract: "CDI",
    freshness: "Il y a 2 jours",
    isNew: false,
    level: "solide",
    why: "Le métier visé dans la santé, un secteur que tu n'as pas mis en priorité.",
  },
  {
    company: "Pennylane",
    domain: "pennylane.com",
    color: "#14A37F",
    photo: "https://images.ctfassets.net/b76knntgaaiu/5f6bEcEKJxLvdKvuwbax05/e292cd12828391facec2a2aa77eecee3/Image_Meta.jpg",
    title: "Product Analyst",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Il y a 3 jours",
    isNew: false,
    level: "tremplin",
    why: "Passerelle vers le produit : tu travailleras chaque jour avec les squads PM.",
  },
  {
    company: "Contentsquare",
    domain: "contentsquare.com",
    color: "#2E3AD6",
    photo: "https://images.ctfassets.net/gwbpo1m641r7/3qlhlZA9G2CUCgfnOBmpOu/a7d57f0fab461bd136bd4f38eca71557/Frame_1948762192.jpg",
    title: "Product Owner, Data Platform",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Il y a 4 jours",
    isNew: false,
    level: "solide",
    why: "Demande 2 à 3 ans d'expérience : un peu au-dessus de ton profil, mais atteignable.",
  },
  {
    company: "Malt",
    domain: "malt.fr",
    color: "#F2545B",
    photo: null,
    title: "Chef de produit junior",
    location: "Lyon ou Paris",
    remote: "Remote partiel",
    contract: "CDI",
    freshness: "Il y a 5 jours",
    isNew: false,
    level: "solide",
    why: "Intitulé différent, mais les missions sont celles d'un PM : roadmap, specs, discovery.",
  },
  {
    company: "Aircall",
    domain: "aircall.io",
    color: "#00B388",
    photo: "https://a.storyblok.com/f/157376/1200x630/e9706cdc7b/og-image-en_1200x630.png/m/1200x0",
    title: "Product Operations Specialist",
    location: "Paris",
    remote: "Hybride",
    contract: "CDI",
    freshness: "Il y a 6 jours",
    isNew: false,
    level: "tremplin",
    why: "Porte d'entrée vers une équipe produit en forte croissance, avec mobilité interne affichée.",
  },
];

const TODAY = {
  firstName: "Camille",
  date: "Lundi 5 octobre",
  followUps: [
    { company: "Doctolib", domain: "doctolib.fr", title: "Product Owner Junior", since: "Candidature envoyée il y a 8 jours" },
    { company: "Lydia", domain: "lydia-app.com", title: "Associate Product Manager", since: "Candidature envoyée il y a 7 jours" },
  ],
  interviews: [
    { company: "Swile", domain: "swile.co", title: "Entretien RH", when: "Jeudi 8 oct.", time: "14 h 30", mode: "Visio" },
  ],
  week: { applied: 3, interviews: 1, saved: 6 },
};

const NAV = ["Aujourd'hui", "Offres", "Entreprises", "Suivi", "Mon CV", "Ma recherche"];

function logoUrl(domain) {
  return `https://unavatar.io/${domain}?fallback=false`;
}

function initials(name) {
  return name.trim()[0].toUpperCase();
}

// Visuel de repli quand l'entreprise n'a pas d'image de partage exploitable : dérivé de sa couleur.
function generatedVisual(color) {
  return `radial-gradient(rgba(255,255,255,.16) 1.4px, transparent 1.6px) 0 0 / 18px 18px,
          radial-gradient(120% 90% at 85% 10%, ${color}55 0%, transparent 55%),
          radial-gradient(90% 80% at 10% 100%, ${color}99 0%, transparent 60%),
          linear-gradient(135deg, ${color} 0%, ${color}cc 45%, #1b1b2f 140%)`;
}

function visualStyle(offer) {
  return offer.photo
    ? `background-image: url('${offer.photo}'); background-size: cover; background-position: center;`
    : `background: ${generatedVisual(offer.color)};`;
}

function logoImg(offer, cls) {
  return `<img class="${cls}" src="${logoUrl(offer.domain)}" alt="${offer.company}"
    onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} logo-fallback',textContent:'${initials(offer.company)}'}))">`;
}
