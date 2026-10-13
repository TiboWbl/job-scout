import { redirect } from "next/navigation";

// The demo opens on its offers, as the app does.
export default function DemoHome() {
  redirect("/demo/offres");
}
