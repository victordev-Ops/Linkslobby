import { createSupabaseServerClient } from '@/lib/supabase/server';
import LobbyListClient, { Lobby } from './LobbyListClient';

export default async function TODLobbyList() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [lobbyResult, profileData] = await Promise.all([
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
      .neq('status', 'finished')
      .order('category', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(4),
    user
      ? supabase.from('profiles').select('is_pro').eq('id', user.id).single().then(r => r.data)
      : Promise.resolve(null),
  ]);

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
      isPro={profileData?.is_pro || false}
    />
  );
}

