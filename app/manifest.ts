import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HotelFlow",
    short_name: "HotelFlow",
    description: "Hotel operations management",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3eee2",
    theme_color: "#485d39",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}