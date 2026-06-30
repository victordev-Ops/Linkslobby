import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "@/components/tod/TODGameClient";
import { XP_REWARDS, applyRewardMultiplier, formatRewardReason, isBonusActive } from "@/hooks/xp";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Next.js 15+ - params is a Promise
export default async function TODGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await both params and cookies
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const cookieStore = await cookies();

  // Initialize Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component cookie setting limitations
          }
        },
      },
    }
  );

  // Auth Check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/tod/${slug}`);
  }

  // 1. Resolve Slug/ID to Lobby UUID
  let lobbyId = slug;
  // Check if slug is a valid UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data: lobbyData } = await supabase
    .from("tod_lobbies")
    .select("id")
    .or(`slug.eq."${slug}",id.eq."${isUUID ? slug : '00000000-0000-0000-0000-000000000000'}"`)
    .maybeSingle();

  if (!lobbyData) {
    // Fallback if not found
    redirect('/tod?error=lobby_not_found');
  }

  lobbyId = lobbyData.id;

  // 2. Auto-Join Logic (Server-side) using resolved lobbyId
  if (lobbyId) {
    // Check if user already has a participant record
    const { data: existingParticipant } = await supabase
      .from("tod_participants")
      .select("id, status")
      .eq("lobby_id", lobbyId)
      .eq("user_id", user.id)
      .maybeSingle();

    // If user is banned, redirect them
    if (existingParticipant?.status === 'banned') {
      redirect('/tod?error=banned');
    }

    // Get lobby privacy setting
    const { data: lobbyInfo } = await supabase
      .from("tod_lobbies")
      .select("is_private")
      .eq("id", lobbyId)
      .single();

    if (existingParticipant) {
      // User has a record - check if they need to rejoin
      if (existingParticipant.status === 'joined') {
        // Already joined, do nothing
      } else if (existingParticipant.status === 'rejected') {
        // Previously rejected - update to pending if private, joined if public
        const newStatus = lobbyInfo?.is_private ? 'pending' : 'joined';
        await supabase
          .from("tod_participants")
          .update({ status: newStatus })
          .eq("id", existingParticipant.id);
      } else if (existingParticipant.status === 'pending') {
        // Still pending, do nothing
      }
    } else {
      // New participant - insert with appropriate status
      const initialStatus = lobbyInfo?.is_private ? 'pending' : 'joined';
      const { error: joinError } = await supabase
        .from("tod_participants")
        .insert({
          lobby_id: lobbyId,
          user_id: user.id,
          status: initialStatus
        });

      if (joinError) {
        console.error("Error joining lobby:", joinError.message);
      } else {
        // Award XP when user successfully joins a public lobby
        if (initialStatus === 'joined' && !lobbyInfo?.is_private) {
          try {
            // Get user's pro status
            const { data: profile } = await supabase
              .from('profiles')
              .select('is_pro, bonus_2x_started_at')
              .eq('id', user.id)
              .single();

            const isPro = profile?.is_pro ?? false;
            const hasBonus = isBonusActive(profile?.bonus_2x_started_at);
            const amount = applyRewardMultiplier(XP_REWARDS.TOD_PARTICIPANT_JOINED, isPro, hasBonus);
            const reason = formatRewardReason('Joined Public Lobby', isPro, hasBonus);

            const { error: xpError } = await supabase.rpc('add_xp', {
              p_user_id: user.id,
              p_amount: amount,
              p_reason: reason,
              p_metadata: { type: 'tod_join', lobby_id: lobbyId, is_public: true }
            });

            if (xpError) {
              console.error("Failed to award XP for joining lobby:", xpError);
            }
          } catch (xpErr) {
            console.error("Error awarding XP:", xpErr);
          }
        }
      }
    }
  }

  return <TODGameClient lobbyId={lobbyId} />;
    }
  
