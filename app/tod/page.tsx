import { createSupabaseServerClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import LobbyListClient, { Lobby } from './LobbyListClient';

// Cache the initial lobby list — client does live realtime updates anyway
const getInitialLobbies = unstable_cache(
  async (userId: string | undefined) => {
    const supabase = await createSupabaseServerClient();

    const { data: lobbyData, error: lobbyError } = await supabase
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
      .neq('status', 'finished')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(4);

    if (lobbyError) {
      console.error("Error fetching lobbies server-side:", lobbyError);
      return [];
    }

    if (!lobbyData) return [];

    const lobbyIds = lobbyData.map(l => l.id);
    const { data: participantData } = await supabase
      .from('tod_participants')
      .select('lobby_id, user_id, status')
      .in('lobby_id', lobbyIds);

    return lobbyData.map(lobby => {
      const participants = participantData?.filter(p => p.lobby_id === lobby.id) || [];
      const userPart = userId ? participants.find(p => p.user_id === userId) : null;
      return {
        ...lobby,
        host_profile: (lobby as any).profiles,
        participant_count: participants.length,
        is_participant: !!userPart,
        user_status: userPart?.status,
      } as unknown as Lobby;
    });
  },
  ['tod-lobbies-initial'],
  { revalidate: 30 } // Revalidate every 30s; client handles live updates via realtime
);

export default async function TODLobbyList() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [lobbiesWithDetails, profileData] = await Promise.all([
    getInitialLobbies(user?.id),
    user
      ? supabase.from('profiles').select('is_pro').eq('id', user.id).single().then(r => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <LobbyListClient
      initialLobbies={lobbiesWithDetails}
      currentUserId={user?.id}
      isPro={profileData?.is_pro || false}
    />
  );
}
