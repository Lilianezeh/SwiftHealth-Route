import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#1b6f93",
    // The pin on the main blue, inside the safe zone, so one file serves as a normal and as a maskable icon (NFR-03).
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
