import { redirect } from "next/navigation";

// "Ma recherche" now opens over the Offres page; old links land there.
export default function RecherchePage() {
  redirect("/offres?recherche=1");
}
