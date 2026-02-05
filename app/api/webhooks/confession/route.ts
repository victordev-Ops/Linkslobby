import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    console.log("🔔 Webhook received");

    // 1. Verify webhook secret for security
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-webhook-secret');

    if (webhookSecret && providedSecret !== webhookSecret) {
        console.error("❌ Unauthorized webhook request");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body once and store for reuse
    let body: { record?: { profile_id?: string; id?: string; message_type?: string } };
    try {
        body = await req.json();
    } catch {
        console.error("❌ Invalid JSON payload");
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { record } = body;

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

        if (!record?.profile_id) {
            console.error("❌ Invalid payload");
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

        // Get message type for notification customization
        const messageType = record.message_type || 'message';

        // SECURITY: Don't include actual message content in push notifications
        // This prevents sensitive confession content from appearing in notification centers
        const payload = {
            title: getNotificationTitle(messageType),
            body: getNotificationBody(messageType),
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
            },
            actions: [
                {
                    action: "view",
                    title: "👀 Read Now",
                    icon: "/logo.png"
                },
                {
                    action: "mark-read",
                    title: "✓ Mark Read",
                    icon: "/logo.png"
                }
            ]
        };

        await webPush.sendNotification(subscription, JSON.stringify(payload));

        console.log("✅ Push notification sent successfully");
        return NextResponse.json({ ok: true, message: "Notification sent" });

    } catch (error: unknown) {
        const err = error as { statusCode?: number; message?: string };
        console.error("❌ Webhook error:", err);

        if (err.statusCode === 410 || err.statusCode === 404) {
            console.log("🧹 Removing expired subscription");

            try {
                const supabaseAdmin = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                );

                // Use the already-parsed body variable instead of re-parsing
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
            details: err.message
        }, { status: 500 });
    }
}

// Helper functions for notification content
function getNotificationTitle(messageType: string): string {
    switch (messageType) {
        case 'confession':
            return '🎭 New Secret Confession!';
        case 'ama':
            return '❓ New Question!';
        case 'anonymous':
            return '💌 Anonymous Message!';
        case 'direct_message':
            return '💬 New Message!';
        default:
            return '📩 New Message!';
    }
}

function getNotificationBody(messageType: string): string {
    switch (messageType) {
        case 'confession':
            return 'Someone shared a secret with you';
        case 'ama':
            return 'Someone asked you a question';
        case 'anonymous':
            return 'You received an anonymous message';
        case 'direct_message':
            return 'You received a direct message';
        default:
            return 'You have a new message waiting';
    }
}

export async function GET() {
    return NextResponse.json({
        status: "Webhook endpoint is working",
        timestamp: new Date().toISOString()
    });
}
