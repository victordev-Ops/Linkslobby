import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import LobbyListClient, { Lobby } from './LobbyListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TODLobbyList() {
  const supabase = await createSupabaseServerClient();
  const headerList = await headers();

  // middleware.ts already verified the session for this request and forwards
  // it via x-user-id — skip the redundant second auth.getUser() network call.
  // Falls back to a direct check if the header is ever missing.
  const headerUserId = headerList.get('x-user-id');
  const userPromise = headerUserId
    ? Promise.resolve({ data: { user: { id: headerUserId } } })
    : supabase.auth.getUser();

  const [{ data: { user } }, lobbyResult, profileData] = await Promise.all([
    userPromise,
    supabase
      .from('tod_lobbies')
      .select(`
        id,
        host_id,
        name,
        category,
        is_private,
        status,
        created_at,
        profiles:host_id (username)
      `)
      .not('status', 'in', '("finished","closed")')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(4),
    headerUserId
      ? supabase.from('profiles').select('is_pro').eq('id', headerUserId).single().then(r => r.data)
      : Promise.resolve(null),
  ]);

  // profileData above only fires when we already trust the header; if we had
  // to fall back to a real auth check, fetch the pro flag now that we know
  // the resolved user id (rare path — only hit if the header is missing).
  const resolvedProfileData = headerUserId
    ? profileData
    : user
      ? (await supabase.from('profiles').select('is_pro').eq('id', user.id).single()).data
      : null;

  const lobbyData = lobbyResult.data || [];

  let lobbiesWithDetails: Lobby[] = [];
  if (lobbyData.length > 0) {
    const lobbyIds = lobbyData.map(l => l.id);
    const { data: participantData } = await supabase
      .from('tod_participants')
      .select('lobby_id, user_id, status')
      .in('lobby_id', lobbyIds);

    lobbiesWithDetails = lobbyData.map(lobby => {
      const participants = participantData?.filter(p => p.lobby_id === lobby.id) || [];
      const userPart = user?.id ? participants.find(p => p.user_id === user.id) : null;
      return {
        ...lobby,
        host_profile: (lobby as any).profiles,
        participant_count: participants.length,
        is_participant: !!userPart,
        user_status: userPart?.status,
      } as unknown as Lobby;
    });
  }

  return (
    <LobbyListClient
      initialLobbies={lobbiesWithDetails}
      currentUserId={user?.id}
      isPro={resolvedProfileData?.is_pro || false}
    />
  );
           }
         
