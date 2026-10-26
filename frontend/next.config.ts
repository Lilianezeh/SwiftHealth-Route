import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One login for everyone (accounts phase 3, 2026-10-26): the old staff address goes to it, so old bookmarks and links still work.
  async redirects() {
    return [
      { source: "/admin/login", destination: "/log-in", permanent: true },
      // No link is ever emailed (a code travels in the email, not a link), so there is one page for both steps.
      { source: "/reset-password", destination: "/forgot-password", permanent: true },
    ];
  },
};

export default nextConfig;
