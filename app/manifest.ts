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
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.png",
        sizes: "192x192 512x512",
        type: "image/png",
        purpose: "any maskable",
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
            src: "/logo.png",
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
            src: "/logo.png",
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
            src: "/logo.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
      },
    ],
    screenshots: [
      {
        src: "/screenshot-wide.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "Say app home screen",
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "750x1334",
        type: "image/png",
        form_factor: "narrow",
        label: "Send anonymous confessions",
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
    display_override: ["standalone", "minimal-ui"],
    protocol_handlers: [],
    launch_handler: {
      client_mode: "focus-existing",
    },
  };
        }
