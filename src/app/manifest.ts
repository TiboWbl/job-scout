import type { MetadataRoute } from "next";

// Lets Scout be added to a phone's home screen with its own icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scout",
    short_name: "Scout",
    description: "Toute ta recherche d'emploi dans un seul onglet.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#17151f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
