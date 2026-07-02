import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Canopy",
    short_name: "Canopy",
    description:
      "Snap a photo of any food label. Canopy reads the ingredients and flags anything you're allergic or sensitive to.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f0",
    theme_color: "#1c7a53",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
