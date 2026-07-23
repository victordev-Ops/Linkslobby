import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Linkslobby — Connect and Play",
    short_name: "Linkslobby",
    description:
      "Linkslobby is a social gaming application. Connect with friends, send confessions, play Truth or Dare, host a Hot Seat, or drop an anonymous message — real games with the friends you already have.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f0a1e",
    theme_color: "#9333EA",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/maskable-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["social", "entertainment", "lifestyle"],
    shortcuts: [
      {
        name: "Play Games",
        short_name: "Play",
        description: "Jump into your dashboard and pick a game",
        url: "/dashboard",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Truth or Dare",
        short_name: "Truth or Dare",
        description: "Host or join a Truth or Dare lobby",
        url: "/tod",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Hot Seat",
        short_name: "Hot Seat",
        description: "Host a live Hot Seat session",
        url: "/hot-seat",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
