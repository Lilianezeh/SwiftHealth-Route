import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SwiftHealth",
    short_name: "SwiftHealth",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#12302a",
    icons: [],
  };
}
