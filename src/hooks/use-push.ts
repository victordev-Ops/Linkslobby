//src/hooks/use-push.ts
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

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
  const supabase = createClient();

  // Background sync: validates and updates existing subscriptions
  const syncSubscription = async (userId: string): Promise<boolean> => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
      return false;
    }
    
    // Only proceed if permission is ALREADY granted
    if (Notification.permission !== "granted") {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      // If permission granted but no subscription exists in browser, recreate it
      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.error("VAPID key missing");
          return false;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      // Update DB with current subscription
      if (subscription) {
        const { error } = await supabase
          .from("profiles")
          .update({ push_subscription: subscription.toJSON() })
          .eq("id", userId);

        if (error) {
          console.error("Sync update failed:", error);
          return false;
        }

        console.log("✅ Push subscription synced");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Background sync failed:", error);
      return false;
    }
  };

  const subscribe = async (userId: string): Promise<boolean> => {
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
      
      if (!vapidKey) {
        console.error("VAPID key missing");
        return false;
      }

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
      console.error("Subscribe error:", err);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const unsubscribe = async (userId: string): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }

      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", userId);

      if (error) throw error;
        
      toast.success("Notifications disabled");
      return true;
    } catch (err) {
      console.error("Unsubscribe error:", err);
      toast.error("Failed to disable notifications");
      return false;
    }
  };

  return { subscribe, unsubscribe, syncSubscription };
      }
