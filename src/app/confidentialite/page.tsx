import Link from "next/link";

export const metadata = { title: "Confidentialité · Scout" };

// Public page: what Scout keeps, why, who processes it, and how to delete everything.
export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 md:py-16">
      <Link href="/" className="font-display text-2xl font-extrabold tracking-tight">
        Scout<span className="text-brand">.</span>
      </Link>
      <h1 className="mt-8 font-display text-4xl font-extrabold tracking-tight">Confidentialité</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Scout est un projet personnel, gratuit et non commercial, ouvert sur invitation. Il garde le strict nécessaire pour trier les offres pour toi et suivre ta recherche. Rien n&apos;est vendu, partagé avec d&apos;autres utilisateurs ou utilisé pour de la publicité.
      </p>

      <div className="mt-10 space-y-8 text-[15.5px] leading-relaxed [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>Ce que Scout garde</h2>
          <ul>
            <li>Ton compte Google : prénom, nom, adresse email et photo, pour te connecter.</li>
            <li>Ta recherche : le texte que tu as écrit et les critères qui en sont tirés.</li>
            <li>
              Ton CV, s&apos;il est fourni : le fichier est lu dans ton navigateur et n&apos;est jamais conservé. Scout n&apos;en garde qu&apos;un résumé (formation, expériences, compétences, langues), ainsi que le nom du fichier et la date de lecture.
            </li>
            <li>Ce que tu fais dans Scout : offres sauvegardées ou écartées (avec la raison), candidatures suivies (dates, contact, notes), entreprises favorites.</li>
          </ul>
        </section>

        <section>
          <h2>L&apos;intelligence artificielle</h2>
          <p className="mt-2">
            Scout utilise Mistral AI, une entreprise française, pour comprendre ta recherche, lire ton CV et juger les offres. <strong>Ton nom et tes coordonnées ne sont jamais envoyés à l&apos;IA</strong> : ils sont retirés du texte du CV avant tout envoi. L&apos;utilisation des données pour l&apos;entraînement des modèles est désactivée.
          </p>
        </section>

        <section>
          <h2>Qui héberge et traite les données</h2>
          <ul>
            <li>Supabase : base de données et connexion, hébergées dans l&apos;Union européenne (Paris).</li>
            <li>Vercel : hébergement du site, fonctions exécutées à Paris.</li>
            <li>Mistral AI : analyse des textes, sans nom ni coordonnées.</li>
            <li>Google : connexion à ton compte.</li>
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
            Tes données restent tant que ton compte existe. Dans « Ma recherche », le bouton « Supprimer mon compte » efface aussitôt et définitivement ta recherche, le résumé de ton CV, tes offres, ton suivi et tes favorites. Tu peux aussi modifier ta recherche et remplacer ton CV à tout moment.
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
              " Pour toute question, écris à la personne qui t'a invité sur Scout."
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
