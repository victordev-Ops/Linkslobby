import { defaultCache } from "@serwist/next/worker";
import { Serwist, NetworkOnly, StaleWhileRevalidate, CacheFirst } from "serwist";
import { ExpirationPlugin } from "serwist";

// Use 'any' to bypass Next.js missing Service Worker global types
declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // CRITICAL: Exclude WebSocket upgrade requests (Supabase Realtime)
      // WebSocket connections must NEVER be intercepted by the service worker
      matcher: ({ request }) => {
        const upgradeHeader = request.headers.get('upgrade');
        return upgradeHeader === 'websocket';
      },
      handler: new NetworkOnly(),
    },
    {
      // CRITICAL: Exclude RSC (React Server Components) requests
      // RSC uses streaming responses that break when cached
      // Identified by: _rsc query parameter OR RSC header
      matcher: ({ url, request }) => {
        const hasRscParam = url.searchParams.has('_rsc');
        const hasRscHeader = request.headers.get('RSC') === '1';
        return hasRscParam || hasRscHeader;
      },
      handler: new NetworkOnly(),
    },
    {
      // Exclude Supabase API calls from caching to ensure fresh data
      // This includes both REST API and Realtime connections
      matcher: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: new NetworkOnly(),
    },
    {
      // SAFE CACHING: Next.js static assets (JS/CSS chunks)
      // These are content-hashed, so CacheFirst is safe and enables offline rendering
      matcher: /\/_next\/static\/.*/,
      handler: new CacheFirst({
        cacheName: 'next-static-v1',
        plugins: [
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    {
      // NAVIGATION CACHING (Pages)
      matcher: ({ request, url }) => {
        if (request.mode !== "navigate") return false;
        // Exclude RSC requests
        if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return false;
        return true;
      },
      handler: async (args) => {
        // Use NetworkOnly for notifications to avoid stale cache issues
        if (args.url.pathname.startsWith("/notifications")) {
          return new NetworkOnly().handle(args);
        }
        // Use StaleWhileRevalidate for other pages
        return new StaleWhileRevalidate({
          cacheName: "pages-cache-v1",
          plugins: [
            {
              cacheWillUpdate: async ({ response }) => {
                if (!response || response.status !== 200) return null;
                const contentType = response.headers.get("content-type");
                if (contentType?.includes("text/x-component")) return null;
                return response;
              },
            },
          ],
        }).handle(args);
      },
    },
    ...defaultCache,
  ],
});

// -----------------------------------------------------------------------------
// PUSH EVENT: Handles incoming messages
// -----------------------------------------------------------------------------
self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Fallback for plain text push
    data = { title: "New Message", body: event.data.text() };
  }

  // FEATURE 1: App Badging (Native Red Dot)
  // If the payload contains 'unread_count', update the app icon badge
  const unreadCount = data.unread_count || 1;
  if ("setAppBadge" in navigator) {
    navigator.setAppBadge(unreadCount).catch((error) => {
      console.error("Failed to set app badge:", error);
    });
  }

  const options = {
    body: data.body || "Someone left a new confession!",

    // 'icon' is the large image displayed in the notification body/shade
    icon: "/logo.png",

    // 'badge' is the small monochrome icon in the Android status bar
    // IMPORTANT: Use a transparent PNG with only white pixels for this!
    // If you use a colored image here, Android may render it as a white square.
    badge: "/logo-removebg-preview.png",

    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
      count: unreadCount
    },

    // FEATURE 2: Notification Actions (Buttons)
    actions: [
      {
        action: "view",
        title: "View",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      }
    ],

    // Group notifications so they don't spam the user (stack them)
    tag: "new-confession",
    renotify: true // Vibrate/Alert again even if a tag exists
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Say App", options)
  );
});

// -----------------------------------------------------------------------------
// NOTIFICATION CLICK: Handles user interaction
// -----------------------------------------------------------------------------
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();

  // Handle "Dismiss" action button
  if (event.action === "dismiss") {
    // FEATURE 1: Clear badge even on dismiss if you want, 
    // or keep it until they actually open the app. 
    // Usually, we clear it when they enter the app.
    return;
  }

  // FEATURE 1: Clear App Badge when user clicks to open
  if ("clearAppBadge" in navigator) {
    navigator.clearAppBadge().catch((error) => console.error(error));
  }

  const targetUrl = new URL(
    event.notification.data?.url || "/",
    self.location.origin
  ).href;

  // Window Focus Logic
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: any[]) => {
        // 1. Try to find an existing window to focus
        for (const client of clientList) {
          // Check if the client URL matches or is the base app
          if (client.url === targetUrl || (client.url.includes(self.location.origin) && "focus" in client)) {
            // Optionally navigate the existing window to the specific notification URL
            if (client.url !== targetUrl) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // 2. If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

serwist.addEventListeners();
