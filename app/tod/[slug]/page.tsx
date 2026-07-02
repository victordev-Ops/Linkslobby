import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "@/components/tod/TODGameClient";
import ClientRedirect from "@/components/ClientRedirect";
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
  const headerList = await headers();

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

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  // middleware.ts already verifies the session on every /tod/* request (it
  // has to, to run its own route protection) and forwards the result via
  // x-user-id. Trust that instead of paying for a second network round trip
  // to Supabase's auth server. Falls back to a direct check if the header is
  // ever missing, so this degrades safely rather than silently.
  //
  // Auth resolution and slug->id resolution don't depend on each other, so
  // they run concurrently instead of one after another.
  const headerUserId = headerList.get('x-user-id');

  const [userResult, lobbyResult] = await Promise.all([
    headerUserId
      ? Promise.resolve({ data: { user: { id: headerUserId } } })
      : supabase.auth.getUser(),
    supabase
      .from("tod_lobbies")
      .select("id")
      .or(`slug.eq."${slug}",id.eq."${isUUID ? slug : '00000000-0000-0000-0000-000000000000'}"`)
      .maybeSingle(),
  ]);

  const user = userResult.data.user;
  const { data: lobbyData } = lobbyResult;

  if (!user) {
    // IMPORTANT: don't call redirect() here. redirect() throws and aborts
    // the response with a 307 before the HTML (and this route's OG
    // metadata) is ever sent — which is why link previews were broken.
    // Rendering the page normally and redirecting client-side after mount
    // keeps the 200 response + metadata intact for crawlers, while real
    // signed-out users still get bounced to /login right away.
    return <ClientRedirect to={`/login?next=/tod/${slug}`} />;
  }

  if (!lobbyData) {
    // Same reasoning as above — defer to client-side redirect.
    return <ClientRedirect to="/tod?error=lobby_not_found" />;
  }

  const lobbyId = lobbyData.id;

  // Auto-Join Logic — this used to be ~4 sequential round trips (existing
  // participant check -> lobby privacy check -> insert/update). Now it's a
  // single RPC call that does the same status-transition logic atomically
  // in the database. See supabase_migration_tod_join_lobby.sql.
  const { data: joinResult, error: joinRpcError } = await supabase.rpc(
    'tod_join_lobby',
    { p_lobby_id: lobbyId }
  );

  if (joinRpcError) {
    console.error("Error joining lobby:", joinRpcError.message);
  }

  // If user is banned, redirect them
  if (joinResult?.banned) {
    return <ClientRedirect to="/tod?error=banned" />;
  }

  // Award XP when user successfully joins a public lobby for the first time.
  // Unchanged from the original — same condition, same reward calculation,
  // same RPC call — just driven by the join RPC's result flag instead of
  // being computed inline across several awaited queries.
  if (joinResult?.newly_joined_public) {
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

  return <TODGameClient lobbyId={lobbyId} />;
      }
          
