import type { MetadataRoute } from "next";

import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

/** The web app manifest: what makes the site installable. Requirements: NFR-03, NFR-04, FR-02, FR-17. Spec: specs/2026-11-02-installable-pwa/.
 * Chrome, Edge and Samsung Internet offer "Install" when this has a name, a start address, display "standalone", a 192 px and a 512 px
 * icon, and the pages have a service worker with a fetch handler (public/sw.js). The names are read from config/brand.ts: the full name
 * for the install dialog, the short one under the icon on a phone. The colours are the Light mode's (the paper of the pages, and the
 * header blue, which is also `viewport.themeColor` in layout.tsx). The icons are drawn by scripts/make-pwa-icons.mjs: the pin on the
 * main blue, once for ordinary use and once as maskable (Android draws a maskable icon in the shape of the phone's own icons, so the pin
 * keeps clear of the edge, inside the central 80%). One purpose for each icon: an icon marked both is drawn badly in one of the two.
 * The shortcuts are what a long press on the installed icon shows: SwiftRescue first, then Find care.
 */
export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" };
  return {
    id: "/",
    name: brand.name,
    short_name: brand.main,
    description: `${siteConfig.tagline}. Verified listings and one-tap calling.`,
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#1b6f93",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: siteConfig.emergencyLink.label,
        short_name: siteConfig.emergencyLink.label,
        description: "Call 112 and see emergency contacts",
        url: siteConfig.emergencyLink.href,
        icons: [shortcutIcon],
      },
      {
        name: siteConfig.findCareLink.label,
        short_name: siteConfig.findCareLink.label,
        description: "Find a hospital, clinic or pharmacy that is open now",
        url: siteConfig.findCareLink.href,
        icons: [shortcutIcon],
      },
    ],
  };
}
