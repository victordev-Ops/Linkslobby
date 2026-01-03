import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/,
      handler: "NetworkOnly",
    },
  ],
});

self.addEventListener("push", (event) => {
  const data = event.data?.json();
  const options = {
    body: data?.body || "Someone left a new confession!",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    data: { url: data?.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(data?.title || "Say App", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});

serwist.addEventListeners();
