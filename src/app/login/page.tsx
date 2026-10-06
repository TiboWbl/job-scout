import { redirect } from "next/navigation";

// The home page is the way in; old links to /login still land there, with their message.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string; compte?: string }> }) {
  const { erreur, compte } = await searchParams;
  redirect(compte ? `/?compte=${encodeURIComponent(compte)}` : erreur ? `/?erreur=${encodeURIComponent(erreur)}` : "/");
}
