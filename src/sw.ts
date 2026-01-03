import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// 1. Define a local interface that doesn't rely on global Worker types
// This satisfies the Next.js compiler without needing to change tsconfig.json
interface SerwistWorkerScope extends SerwistGlobalConfig {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  addEventListener: (type: string, listener: (event: any) => void) => void;
  registration: ServiceWorkerRegistration;
  clients: Clients;
}

declare const self: SerwistWorkerScope;

// 2. Initialize Serwist
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Supabase rule first
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: "NetworkOnly",
    },
    ...defaultCache,
  ],
});

// 3. Push Listener

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
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Say App", options)
  );
});

// 4. Notification Click Handling
self.addEventListener("notificationclick", (event: any) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if ("focus" in client && "navigate" in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

serwist.addEventListeners();
    
