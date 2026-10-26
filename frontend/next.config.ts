import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // One login for everyone (accounts phase 3, 2026-10-26): the old staff address goes to it, so old bookmarks and links still work.
  async redirects() {
    return [{ source: "/admin/login", destination: "/log-in", permanent: true }];
  },
};

export default nextConfig;
