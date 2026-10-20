import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** robots.txt. Requirements: NFR-12. Decision D7 in specs/2026-10-20-info-pages/requirements.md: everything is open to search
 * engines except the staff and provider areas, and the sitemap is named. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/provider/"] },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
