import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Scout",
  description: "Toute ta recherche d'emploi dans un seul onglet : les offres qui te correspondent, expliquées, et le suivi de tes candidatures.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
