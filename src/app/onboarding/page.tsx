import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { SearchSetup } from "@/components/search-setup";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("display_name, onboarded_at").eq("id", user.id).single();
  if (profile?.onboarded_at) redirect("/offres");

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <p className="font-display text-2xl font-extrabold tracking-tight">
        Scout<span className="text-brand">.</span>
      </p>
      <h1 className="mt-8 font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
        {profile?.display_name ? `Bienvenue ${profile.display_name} !` : "Bienvenue !"}
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
        Trois minutes pour décrire ta recherche. Scout s&apos;occupe ensuite de lire les offres et de te montrer celles qui valent ton temps.
      </p>
      <div className="mt-10">
        <SearchSetup mode="onboarding" />
      </div>
    </main>
  );
}
