import { redirect } from "next/navigation";

// Shown over the demo's Offres page ("Modifier ma recherche"); old links land there.
export default function DemoRecherchePage() {
  redirect("/demo/offres?recherche=1");
}
