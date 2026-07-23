import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Say - Anonymous Confessions",
    short_name: "Say",
    description: "Share and receive anonymous confessions. Get instant notifications when someone confesses to you.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#8B5CF6",
    theme_color: "#7C3AED",
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
        name: "Inbox",
        short_name: "Inbox",
        description: "View your confessions",
        url: "/inbox",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "Send Confession",
        short_name: "Send",
        description: "Send anonymous confession",
        url: "/send",
        icons: [
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
      {
        name: "My Link",
        short_name: "Link",
        description: "Share your confession link",
        url: "/link",
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
