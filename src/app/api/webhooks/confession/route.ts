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
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { record } = body;
    
    if (!record?.profile_id) {
      console.error("❌ Invalid payload - missing profile_id:", body);
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    console.log("📩 Processing confession for user:", record.profile_id);

    // Get the recipient's profile and subscription
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("push_subscription, username")
      .eq("id", record.profile_id)
      .single();

    if (profileError) {
      console.error("❌ Profile fetch error:", profileError);
      return NextResponse.json({ 
        error: "Profile not found",
        details: profileError.message 
      }, { status: 404 });
    }

    if (!profile?.push_subscription) {
      console.log("⚠️ No push subscription for user:", record.profile_id);
      return NextResponse.json({ 
        ok: true, 
        message: "No subscription found" 
      });
    }

    console.log("📱 Found push subscription for:", profile.username || record.profile_id);

    // Send push notification
    try {
      const payload = JSON.stringify({
        title: "New Confession! 🎭",
        body: record.message?.substring(0, 80) + "..." || "Someone sent you a confession",
        url: "/confessions",
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png"
      });

      await webPush.sendNotification(
        profile.push_subscription as any,
        payload
      );

      console.log("✅ Push notification sent to:", record.profile_id);
      
      return NextResponse.json({ 
        ok: true, 
        message: "Notification sent successfully" 
      });
    } catch (pushError: any) {
      console.error("❌ Push send error:", pushError);

      // Clean up expired/invalid subscriptions
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        console.log("🧹 Removing expired subscription for:", record.profile_id);
        
        await supabaseAdmin
          .from("profiles")
          .update({ push_subscription: null })
          .eq("id", record.profile_id);
        
        return NextResponse.json({ 
          ok: true, 
          message: "Expired subscription removed" 
        });
      }

      // Return error but don't fail the webhook
      return NextResponse.json({ 
        ok: false, 
        error: "Failed to send notification",
        details: pushError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
          }
