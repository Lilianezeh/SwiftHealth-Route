import type { Metadata, Viewport } from "next";

import { IdleSignOut } from "@/components/layout/IdleSignOut";
import { siteConfig } from "@/config/site";
import { THEME_SCRIPT } from "@/lib/theme/themeScript";
import "@/styles/globals.css";

export const metadata: Metadata = {
  // "Page | SwiftHealth Route" for every page that has its own title; the home page keeps the plain name (decision D6).
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: `${siteConfig.name}: ${siteConfig.tagline}. Verified listings and one-tap calling.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b6f93" };

/** Root layout: the page's html and body, and the one warning before an automatic sign-out (`IdleSignOut`, drawn only when someone is
 * logged in), and nothing else. The header and the footer are drawn by the layout of each route group
 * (`app/(home)/`, `app/(public)/`, `app/(dashboards)/`) and by the not-found page, as server components (R44).
 * The few lines of script in the head set the colour theme (Light, Dark or the system's) before the first paint, so a dark page never
 * flashes white (specs/frontend/ui-spec.md, "Dark mode"). The script sets `data-theme` on the html element before React looks at it,
 * so that one attribute is excluded from the hydration check (`suppressHydrationWarning`).
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <IdleSignOut />
      </body>
    </html>
  );
}
