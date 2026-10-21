import type { Metadata, Viewport } from "next";

import { siteConfig } from "@/config/site";
import "@/styles/globals.css";

export const metadata: Metadata = {
  // "Page | SwiftHealth Route" for every page that has its own title; the home page keeps the plain name (decision D6).
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: `${siteConfig.name}: ${siteConfig.tagline}. Verified listings and one-tap calling.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b6f93" };

/** Root layout: the page's html and body, and nothing else. The header and the footer are drawn by the layout of each route group
 * (`app/(home)/`, `app/(public)/`, `app/(dashboards)/`) and by the not-found page, as server components (R44).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
