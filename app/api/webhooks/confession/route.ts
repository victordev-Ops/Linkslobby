import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log("🔔 Webhook received");

    try {
        const vapidSubject = process.env.VAPID_SUBJECT;
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
            console.error("❌ Missing VAPID configuration");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("❌ Missing Supabase configuration");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();
        const { record } = body;

        if (!record?.profile_id) {
            console.error("❌ Invalid payload");
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        console.log("👤 Processing for user:", record.profile_id);

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("push_subscription, username")
            .eq("id", record.profile_id)
            .single();

        if (profileError || !profile) {
            console.error("❌ Profile error:", profileError);
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        if (!profile.push_subscription) {
            console.log("⚠️ No subscription for:", profile.username);
            return NextResponse.json({ ok: true, message: "No subscription" });
        }

        const subscription = typeof profile.push_subscription === 'string'
            ? JSON.parse(profile.push_subscription)
            : profile.push_subscription;

        console.log("📱 Sending push to:", profile.username);

        // Get confession count for personalization
        const { count } = await supabaseAdmin
            .from("confessions")
            .select("*", { count: 'exact', head: true })
            .eq("profile_id", record.profile_id);

        // Create personalized notification
        const messagePreview = record.message?.substring(0, 100) || "Someone sent you a confession";
        const confessionCount = count || 0;

        const payload = {
            title: "🎭 New Secret Confession!",
            body: messagePreview + (messagePreview.length >= 100 ? "..." : ""),
            icon: "/favicon.ico",
            badge: "/logo.png",
            image: "/logo.png",
            tag: "confession-notification",
            renotify: true,
            requireInteraction: true,
            vibrate: [200, 100, 200, 100, 200],
            silent: false,
            data: {
                url: "/inbox",
                confessionId: record.id,
                timestamp: new Date().toISOString(),
                username: profile.username,
                messagePreview: messagePreview
            },
            actions: [
                {
                    action: "view",
                    title: "👀 Read Now",
                    icon: "/logo.png"
                },
                {
                    action: "reply",
                    title: "💬 Quick Reply",
                    icon: "/logo.png"
                },
                {
                    action: "mark-read",
                    title: "✓ Mark Read",
                    icon: "/logo.png"
                }
            ]
        };

        // Add personalized message based on confession count
        if (confessionCount === 1) {
            payload.title = "🎉 Your First Confession!";
            payload.body = "Someone just shared their secret with you! " + messagePreview;
        } else if (confessionCount > 10) {
            payload.title = `🔥 Confession #${confessionCount}!`;
            payload.body = `You're popular! New confession: ${messagePreview}`;
        } else if (confessionCount > 5) {
            payload.title = "✨ Another Confession!";
        }

        await webPush.sendNotification(subscription, JSON.stringify(payload));

        console.log("✅ Push notification sent successfully");
        return NextResponse.json({ ok: true, message: "Notification sent" });

    } catch (error: any) {
        console.error("❌ Webhook error:", error);

        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log("🧹 Removing expired subscription");

            try {
                const body = await req.json().catch(() => ({}));
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                await supabaseAdmin
                    .from("profiles")
                    .update({ push_subscription: null })
                    .eq("id", body.record?.profile_id);
            } catch (cleanupError) {
                console.error("Failed to clean up subscription:", cleanupError);
            }

            return NextResponse.json({ ok: true, message: "Expired subscription removed" });
        }

        return NextResponse.json({
            error: "Internal error",
            details: error.message
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        status: "Webhook endpoint is working",
        timestamp: new Date().toISOString()
    });
}
