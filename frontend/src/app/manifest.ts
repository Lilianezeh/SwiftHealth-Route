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
    icons: [],
  };
}
