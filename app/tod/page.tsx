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
    // Single RPC round trip instead of a join query + separate count query.
    const { data: rpcRows } = await supabase.rpc('get_user_tod_lobbies', {
      p_user_id: user.id,
    });

    lobbiesWithDetails = (rpcRows || []).map((r: any) => ({
      id: r.id,
      host_id: r.host_id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      status: r.status,
      created_at: r.created_at,
      host_profile: r.host_username ? { username: r.host_username } : undefined,
      participant_count: r.participant_count || 0,
      is_participant: true,
      user_status: r.user_status,
    })) as Lobby[];
  }

  return (
    <LobbyListClient
      initialLobbies={lobbiesWithDetails}
      currentUserId={user?.id}
      isPro={resolvedProfileData?.is_pro || false}
    />
  );
}
