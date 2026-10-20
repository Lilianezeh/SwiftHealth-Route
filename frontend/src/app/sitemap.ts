import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** sitemap.xml. Requirements: NFR-12. Decision D7 in specs/2026-10-20-info-pages/requirements.md: the static public pages only. The
 * listing pages need the API at build time and are left for a later improvement. No staff, provider, search or report address, and
 * no query string, so no position can be in it. */
const STATIC_PAGES = ["", "/find", "/emergency", "/about", "/how-we-verify", "/privacy", "/terms", "/contact", "/list-your-facility"];

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PAGES.map((path) => ({ url: `${siteConfig.siteUrl}${path}` }));
}
