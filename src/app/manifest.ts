import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Macros — nutrition & training log",
    short_name: "Macros",
    start_url: "/",
    display: "standalone",
    background_color: "#e8ebee",
    theme_color: "#0e1116",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
