import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

export function usePushSubscription() {
  const subscribe = async (userId: string) => {
    try {
      // 1. Check browser support
      if (!("Notification" in window)) {
        toast.error("Push notifications not supported in this browser");
        return false;
      }

      if (!("serviceWorker" in navigator)) {
        toast.error("Service workers not supported");
        return false;
      }

      // 2. Check VAPID key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("❌ VAPID key missing in environment variables");
        toast.error("Push notifications not configured. Contact support.");
        return false;
      }

      // 3. Request permission
      let permission = Notification.permission;
      
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      
      if (permission === "denied") {
        toast.error("Notification permission denied. Enable in browser settings.");
        return false;
      }

      if (permission !== "granted") {
        toast.info("Notification permission required");
        return false;
      }

      // 4. Wait for service worker
      const registration = await navigator.serviceWorker.ready;
      console.log("✅ Service Worker ready");

      // 5. Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        console.log("📱 Already subscribed, updating database...");
      } else {
        // 6. Create new subscription
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey)
          });
          console.log("✅ New subscription created");
        } catch (subError) {
          console.error("❌ Subscription error:", subError);
          toast.error("Failed to subscribe to notifications");
          return false;
        }
      }

      // 7. Save to database
      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: subscription.toJSON() })
        .eq("id", userId);

      if (error) {
        console.error("❌ Database error:", error);
        toast.error("Failed to save subscription");
        return false;
      }

      console.log("✅ Subscription saved to database");
      toast.success("Push notifications enabled!");
      return true;
    } catch (err) {
      console.error("❌ Subscribe error:", err);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const unsubscribe = async (userId: string) => {
    try {
      // 1. Get service worker
      if (!("serviceWorker" in navigator)) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      // 2. Unsubscribe from push
      if (subscription) {
        const successful = await subscription.unsubscribe();
        console.log(successful ? "✅ Unsubscribed from push" : "⚠️ Unsubscribe failed");
      }

      // 3. Clear from database
      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", userId);

      if (error) {
        console.error("❌ Database clear error:", error);
        toast.error("Failed to disable notifications");
        return false;
      }

      console.log("✅ Subscription removed from database");
      toast.success("Push notifications disabled");
      return true;
    } catch (err) {
      console.error("❌ Unsubscribe error:", err);
      toast.error("Failed to disable notifications");
      return false;
    }
  };

  return { subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  
  for (let i = 0; i < rawData.length; ++i) {
    view[i] = rawData.charCodeAt(i);
  }
  
  return view;
        }
