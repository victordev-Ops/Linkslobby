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
  const headerUserId = headerList.get('x-user-id');
  const userPromise = headerUserId
    ? Promise.resolve({ data: { user: { id: headerUserId } } })
    : supabase.auth.getUser();

  const [{ data: { user } }, profileData] = await Promise.all([
    userPromise,
    headerUserId
      ? supabase.from('profiles').select('is_pro').eq('id', headerUserId).single().then(r => r.data)
      : Promise.resolve(null),
  ]);

  const resolvedProfileData = headerUserId
    ? profileData
    : user
      ? (await supabase.from('profiles').select('is_pro').eq('id', user.id).single()).data
      : null;

  let lobbiesWithDetails: Lobby[] = [];

  if (user?.id) {
    // Only lobbies this user is actually part of (host or participant) —
    // there's no more browsing a public/private directory.
    const { data: participantRows } = await supabase
      .from('tod_participants')
      .select(`
        status,
        tod_lobbies (
          id, host_id, name, slug, category, status, created_at,
          profiles:host_id (username)
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'joined');

    const rows = (participantRows || []).filter(r => (r as any).tod_lobbies);
    const lobbyIds = rows.map(r => (r as any).tod_lobbies.id);

    let participantCounts: Record<string, number> = {};
    if (lobbyIds.length > 0) {
      const { data: countRows } = await supabase
        .from('tod_participants')
        .select('lobby_id')
        .eq('status', 'joined')
        .in('lobby_id', lobbyIds);

      participantCounts = (countRows || []).reduce((acc, p) => {
        acc[p.lobby_id] = (acc[p.lobby_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }

    lobbiesWithDetails = rows.map(r => {
      const lobby = (r as any).tod_lobbies;
      return {
        ...lobby,
        host_profile: lobby.profiles,
        participant_count: participantCounts[lobby.id] || 0,
        is_participant: true,
        user_status: (r as any).status,
      } as Lobby;
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
