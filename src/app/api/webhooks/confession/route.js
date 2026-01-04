import { NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize VAPID
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  console.log("🔔 Webhook received");

  try {
    const body = await req.json();
    const { record } = body;
    
    if (!record?.profile_id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("push_subscription, username")
      .eq("id", record.profile_id)
      .single();

    if (!profile?.push_subscription) {
      return NextResponse.json({ ok: true, message: "No subscription" });
    }

    // Parse the subscription string from DB
    const subscription = typeof profile.push_subscription === 'string'
      ? JSON.parse(profile.push_subscription)
      : profile.push_subscription;

    await webPush.sendNotification(
      subscription,
      JSON.stringify({
        title: "New Confession! 🎭",
        body: record.message?.substring(0, 80) + "...",
        url: "/inbox"
      })
    );

    console.log("✅ Push sent to:", profile.username);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
