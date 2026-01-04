import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Configure VAPID (this runs on startup)
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:test@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// IMPORTANT: Must export as POST (not default export)
export async function POST(request: NextRequest) {
  console.log("🔔 Webhook received at:", new Date().toISOString());

  try {
    // Parse request body
    const body = await request.json();
    console.log("📦 Body:", JSON.stringify(body, null, 2));

    const { record } = body;
    
    if (!record?.profile_id) {
      console.error("❌ Invalid payload - missing profile_id");
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    console.log("👤 Processing for user:", record.profile_id);

    // Get the recipient's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("push_subscription, username")
      .eq("id", record.profile_id)
      .single();

    if (profileError) {
      console.error("❌ Profile error:", profileError);
      return NextResponse.json({ 
        error: "Profile not found",
        details: profileError.message 
      }, { status: 404 });
    }

    if (!profile?.push_subscription) {
      console.log("⚠️ No subscription for:", profile?.username || record.profile_id);
      return NextResponse.json({ 
        ok: true, 
        message: "No subscription" 
      });
    }

    console.log("📱 Sending push to:", profile.username);

    // Send push notification
    try {
      const payload = JSON.stringify({
        title: "New Confession! 🎭",
        body: record.message?.substring(0, 80) + "..." || "Someone sent you a confession",
        url: "/inbox",
        icon: "/icon-192x192.png",
        badge: "/icon-192x192.png"
      });

      await webPush.sendNotification(profile.push_subscription, payload);

      console.log("✅ Push sent successfully");
      
      return NextResponse.json({ 
        ok: true, 
        message: "Notification sent" 
      });
    } catch (pushError: any) {
      console.error("❌ Push error:", {
        statusCode: pushError.statusCode,
        message: pushError.message
      });

      // Clean up expired subscriptions
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        console.log("🧹 Removing expired subscription");
        
        await supabaseAdmin
          .from("profiles")
          .update({ push_subscription: null })
          .eq("id", record.profile_id);
        
        return NextResponse.json({ 
          ok: true, 
          message: "Expired subscription removed" 
        });
      }

      return NextResponse.json({ 
        ok: false, 
        error: "Push failed",
        details: pushError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ 
      error: "Internal error",
      details: error.message 
    }, { status: 500 });
  }
}

// Optional: Add GET for testing
export async function GET() {
  return NextResponse.json({ 
    status: "Webhook endpoint is working",
    timestamp: new Date().toISOString()
  });
            }
