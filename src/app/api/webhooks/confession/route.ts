import { NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configure VAPID
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { record } = await req.json();
    
    if (!record?.profile_id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // CRITICAL FIX: Use 'profile_id', not 'recipient_id'
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("push_subscription")
      .eq("id", record.profile_id)
      .single();

    if (error) {
      console.error("Profile fetch error:", error);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile?.push_subscription) {
      console.log("No push subscription for user:", record.profile_id);
      return NextResponse.json({ ok: true, message: "No subscription" });
    }

    // Send push notification
    try {
      await webPush.sendNotification(
        profile.push_subscription as any,
        JSON.stringify({
          title: "New Confession! 🎭",
          body: record.message?.substring(0, 80) + "..." || "Someone sent you a confession",
          url: "/confessions",
          icon: "/icon-192x192.png",
          badge: "/icon-192x192.png"
        })
      );

      console.log("✅ Push notification sent to:", record.profile_id);
    } catch (pushError: any) {
      console.error("Push send error:", pushError);

      // Clean up expired subscriptions
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await supabaseAdmin
          .from("profiles")
          .update({ push_subscription: null })
          .eq("id", record.profile_id);
        
        console.log("Removed expired subscription for:", record.profile_id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
      }
