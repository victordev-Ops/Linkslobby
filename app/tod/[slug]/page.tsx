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
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const cookieStore = await cookies();
  const headerList = await headers();

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
    return <ClientRedirect to={`/login?next=/tod/${slug}`} />;
  }

  if (!lobbyData) {
    return <ClientRedirect to="/tod?error=lobby_not_found" />;
  }

  const lobbyId = lobbyData.id;

  // Auto-Join Logic — single RPC call, atomic in the database. There's no
  // more private/pending branch: tod_join_lobby now either joins the user
  // directly or reports them as banned. See the updated function in
  // supabase_migration_tod_no_private_lobbies.sql.
  const { data: joinResult, error: joinRpcError } = await supabase.rpc(
    'tod_join_lobby',
    { p_lobby_id: lobbyId }
  );

  if (joinRpcError) {
    console.error("Error joining lobby:", joinRpcError.message);
  }

  if (joinResult?.banned) {
    return <ClientRedirect to="/tod?error=banned" />;
  }

  // Award XP the first time a user joins someone else's lobby.
  if (joinResult?.newly_joined) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_pro, bonus_2x_started_at')
        .eq('id', user.id)
        .single();

      const isPro = profile?.is_pro ?? false;
      const hasBonus = isBonusActive(profile?.bonus_2x_started_at);
      const amount = applyRewardMultiplier(XP_REWARDS.TOD_PARTICIPANT_JOINED, isPro, hasBonus);
      const reason = formatRewardReason('Joined Lobby', isPro, hasBonus);

      const { error: xpError } = await supabase.rpc('add_xp', {
        p_user_id: user.id,
        p_amount: amount,
        p_reason: reason,
        p_metadata: { type: 'tod_join', lobby_id: lobbyId }
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
