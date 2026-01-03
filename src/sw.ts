import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// 1. Explicitly define the Global Scope to satisfy the Next.js compiler
interface ServiceWorkerGlobalScope extends WorkerGlobalScope, SerwistGlobalConfig {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
}

declare const self: ServiceWorkerGlobalScope;

// 2. Initialize Serwist
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Prioritize Supabase Network-Only rule
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
});

// 3. Robust Push Listener
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "New Message", body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: data.body || "Someone left a new confession!",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
    actions: [
      { action: "open", title: "View Confession" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Say App", options)
  );
});

// 4. Tab-aware Notification Click Handling

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if available
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      // Otherwise open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

serwist.addEventListeners();
