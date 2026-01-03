import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// 1. Initialize Serwist with the runtime caching we moved from the config
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Ensure Supabase API calls are never cached to avoid auth/stale data issues
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
});

// 2. Enhanced Push Listener
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    // Fallback if data isn't valid JSON
    data = { title: "New Message", body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: data.body || "Someone left a new confession!",
    icon: "/icon-192x192.png", // Ensure these exist in /public
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

// 3. Robust Notification Click Handling
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus().then(() => {
            if ("navigate" in client) return client.navigate(targetUrl);
          });
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

serwist.addEventListeners();
       
