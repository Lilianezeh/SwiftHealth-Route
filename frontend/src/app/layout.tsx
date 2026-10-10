import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { siteConfig } from "@/config/site";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: siteConfig.name,
  description: `${siteConfig.name}: ${siteConfig.tagline}. Verified listings, one-tap calling, now in Enugu.`,
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b6f93" };

/** Root layout: wraps every page with the header and footer. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
