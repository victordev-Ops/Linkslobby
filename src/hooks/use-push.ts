import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  // This function syncs the browser's current subscription with the database
  const syncSubscription = async (userId: string) => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    
    // Only proceed if permission is ALREADY granted
    if (Notification.permission !== "granted") return;

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // If permission is granted but no subscription exists in browser, try to renew it
      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }
      }

      // If we have a valid subscription, force update the DB to ensure they match
      if (subscription) {
        await supabase
          .from("profiles")
          .update({ push_subscription: subscription.toJSON() })
          .eq("id", userId);
        console.log("🔄 Push subscription synced in background");
      }
    } catch (error) {
      console.error("Background sync failed:", error);
    }
  };

  const subscribe = async (userId: string) => {
    try {
      if (!("Notification" in window)) {
        toast.error("Not supported in this browser");
        return false;
      }

      // 1. Request Permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.info("Permission required for notifications");
        return false;
      }

      // 2. Get Service Worker
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      
      if (!vapidKey) return false;

      // 3. Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // 4. Save to DB
      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: subscription.toJSON() })
        .eq("id", userId);

      if (error) throw error;
      
      toast.success("Notifications enabled!");
      return true;
    } catch (err) {
      console.error(err);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const unsubscribe = async (userId: string) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();

      await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", userId);
        
      toast.success("Notifications disabled");
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  return { subscribe, unsubscribe, syncSubscription };
                  }
