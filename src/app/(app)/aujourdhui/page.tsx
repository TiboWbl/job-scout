import { redirect } from "next/navigation";

// "Aujourd'hui" became the offers page: old links and bookmarks land there.
export default function TodayPage() {
  redirect("/offres");
}
