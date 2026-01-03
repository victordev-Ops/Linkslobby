import { NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

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
  const { record } = await req.json();
  
  // 1. Get the recipient's profile and subscription
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("push_subscription")
    .eq("id", record.recipient_id) // Change this to your column name
    .single();

  if (profile?.push_subscription) {
    try {
      await webPush.sendNotification(
        profile.push_subscription as any,
        JSON.stringify({
          title: "New Confession!",
          body: record.content?.substring(0, 50) + "...",
          url: "/confessions"
        })
      );
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Remove expired subscription
        await supabaseAdmin.from("profiles").update({ push_subscription: null }).eq("id", record.recipient_id);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
