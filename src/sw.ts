import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

// Use 'any' to bypass Next.js missing Service Worker global types
declare const self: any;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // CHANGE: Use 'matcher' instead of 'urlPattern'
      matcher: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

// Push Listener
self.addEventListener("push", (event: any) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "New Message", body: event.data.text() };
  }

  const options = {
    body: data.body || "Someone left a new confession!",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data.title || "Say App", options));
});

// Notification Click Listener
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

serwist.addEventListeners();
