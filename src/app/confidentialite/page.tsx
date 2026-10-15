
export const metadata = { title: "Confidentialité" };

// Public page: what Scout keeps, why, who processes it, and how to delete everything.
export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <div className="mx-auto w-full max-w-3xl px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-4xl font-extrabold md:text-5xl tracking-tight">Confidentialité</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Scout est un projet personnel, gratuit et non commercial, ouvert sur invitation. Il garde le strict nécessaire pour trier les offres pour toi et suivre ta recherche. Rien n&apos;est vendu, partagé avec d&apos;autres utilisateurs ou utilisé pour de la publicité.
      </p>

      <div className="mt-8 space-y-8 rounded-[22px] border border-line bg-surface p-6 text-[15.5px] leading-relaxed md:p-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Ce que Scout garde</h2>
          <ul>
            <li>Ton compte Google : prénom, nom, adresse email et photo, pour te connecter. La date de ta dernière visite, pour savoir qui utilise encore Scout.</li>
            <li>Ta recherche : le texte que tu as écrit et les critères qui en sont tirés.</li>
            <li>
              Ton CV, s&apos;il est fourni : le fichier est lu dans ton navigateur et n&apos;est jamais conservé. Scout n&apos;en garde qu&apos;un résumé (formation, expériences, compétences, langues), ainsi que le nom du fichier et la date de lecture. Une analyse de « Mon CV » garde le nom du fichier, la note, les corrections conseillées, la lecture recruteur et les quelques lignes dont une réécriture est proposée, ainsi que la liste des compétences que ton CV cite (pour « Mon marché ») ; jamais le CV entier. Tu peux supprimer chaque analyse.
            </li>
            <li>Ce que tu fais dans Scout : offres sauvegardées ou écartées (avec la raison), candidatures suivies (dates, contact, notes), entreprises favorites, et les textes que tu demandes à Scout de préparer (message, lettre de motivation, préparation d&apos;entretien).</li>
            <li>Les chiffres de ton marché (compétences demandées par les offres de ton métier), calculés chaque jour : seulement des totaux. Si tu partages la carte de ton marché, elle ne contient rien de ton CV.</li>
          </ul>
        </section>

        <section>
          <h2>L&apos;intelligence artificielle</h2>
          <p className="mt-2">
            Scout utilise Mistral AI, une entreprise française, pour comprendre ta recherche, lire ton CV et juger les offres. <strong>Ton nom et tes coordonnées ne sont jamais envoyés à l&apos;IA</strong> : ils sont retirés du texte du CV avant tout envoi. L&apos;utilisation des données pour l&apos;entraînement des modèles est désactivée. Les emails de Scout (le code de connexion, et l&apos;email des coups de cœur si tu l&apos;actives dans Paramètres) partent par Gmail (Google) vers l&apos;adresse de ton compte.
          </p>
        </section>

        <section>
          <h2>Qui héberge et traite les données</h2>
          <ul>
            <li>Supabase : base de données et connexion, hébergées dans l&apos;Union européenne (Paris).</li>
            <li>Vercel : hébergement du site, fonctions exécutées à Paris.</li>
            <li>Mistral AI : analyse des textes, sans nom ni coordonnées.</li>
            <li>Google : connexion avec ton compte Google si tu la choisis, et envoi des emails par Gmail.</li>
            <li>logo.dev : logos des entreprises ; aucune donnée te concernant ne lui est transmise.</li>
          </ul>
        </section>

        <section>
          <h2>Cookies</h2>
          <p className="mt-2">Un seul cookie, nécessaire à ta connexion. Pas de mesure d&apos;audience, pas de publicité.</p>
        </section>

        <section>
          <h2>Combien de temps, et comment tout supprimer</h2>
          <p className="mt-2">
            Tes données restent tant que ton compte existe. Dans « Paramètres », le bouton « Supprimer mon compte » efface aussitôt et définitivement ta recherche, le résumé de ton CV, tes offres, ton suivi et tes favorites. Tu peux recréer un compte quand tu veux, et modifier ta recherche ou remplacer ton CV à tout moment.
          </p>
        </section>

        <section>
          <h2>Tes droits</h2>
          <p className="mt-2">
            Tu peux accéder à tes données, les rectifier ou les effacer, et t&apos;opposer à leur traitement (règlement européen sur la protection des données).
            {contact ? (
              <>
                {" "}Pour toute question : <a href={`mailto:${contact}`} className="font-medium underline underline-offset-4">{contact}</a>.
              </>
            ) : (
              " Pour toute question, écris à l'auteur de Scout."
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
