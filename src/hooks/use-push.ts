import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = createClient();

export function usePushSubscription() {
  const subscribe = async (userId: string) => {
    try {
      // Check browser support
      if (!("Notification" in window)) {
        toast.error("Push notifications not supported in this browser");
        return;
      }

      if (!("serviceWorker" in navigator)) {
        toast.error("Service workers not supported");
        return;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      
      if (permission === "denied") {
        toast.error("Notification permission denied. Enable in browser settings.");
        return;
      }

      if (permission !== "granted") {
        toast.info("Notification permission is required");
        return;
      }

      // Wait for SW to be ready
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      // Subscribe if not already subscribed
      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.error("VAPID key missing");
          toast.error("Push notifications not configured");
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      }

      // Save to Supabase
      const { error } = await supabase
        .from("profiles")
        .update({ push_subscription: subscription.toJSON() })
        .eq("id", userId);

      if (error) {
        console.error("Supabase error:", error);
        toast.error("Failed to save subscription");
        return;
      }

      toast.success("Push notifications enabled!");
      console.log("✅ Push subscription saved");
    } catch (err) {
      console.error("Push subscription error:", err);
      toast.error("Failed to enable notifications");
    }
  };

  const unsubscribe = async (userId: string) => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      // Clear from database
      await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", userId);

      toast.success("Push notifications disabled");
    } catch (err) {
      console.error("Unsubscribe error:", err);
      toast.error("Failed to disable notifications");
    }
  };

  return { subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
        }
