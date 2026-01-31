import { createSupabaseServerClient } from '@/lib/supabase/server';
import LobbyListClient, { Lobby } from './LobbyListClient';

// Server Component (no 'use client')
export default async function TODLobbyList() {
  const supabase = await createSupabaseServerClient();

  // 1. Get current user (to check participation status)
  const { data: { user } } = await supabase.auth.getUser();

  // 2. Fetch lobbies (Server Side)
  // We duplicate the fetch logic here to pass initial data
  // Ideally this logic could be shared in a lib function
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
    .order('category', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(4);

  if (lobbyError) {
    console.error("Error fetching lobbies server-side:", lobbyError);
  }

  // 3. Fetch participant counts and user participation
  let lobbiesWithDetails: Lobby[] = [];

  if (lobbyData) {
    const lobbyIds = lobbyData.map(l => l.id);
    const { data: participantData } = await supabase
      .from('tod_participants')
      .select('lobby_id, user_id, status')
      .in('lobby_id', lobbyIds);

    lobbiesWithDetails = lobbyData.map(lobby => {
      const participants = participantData?.filter(p => p.lobby_id === lobby.id) || [];
      const userPart = user ? participants.find(p => p.user_id === user.id) : null;
      return {
        ...lobby,
        host_profile: lobby.profiles, // mapped from join
        participant_count: participants.length,
        is_participant: !!userPart,
        user_status: userPart?.status
      } as unknown as Lobby; // Type assertion needed due to join structure
    });
  }

  // 4. Fetch user's pro status
  const { data: profileData } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', user.id)
    .single();

  return (
    <LobbyListClient
      initialLobbies={lobbiesWithDetails}
      currentUserId={user?.id}
      isPro={profileData?.is_pro || false}
    />
  );
}

