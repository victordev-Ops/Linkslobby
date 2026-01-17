import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TODGameClient from "./TODGameClient";

export default async function TODPage({ params }: { params: { lobbyId: string } }) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/tod/${params.lobbyId}`);

  // AUTO-JOIN LOGIC: Ensure user is a participant
  await supabase
    .from("tod_participants")
    .upsert({ lobby_id: params.lobbyId, user_id: user.id }, { onConflict: 'lobby_id,user_id' });

  return <TODGameClient lobbyId={params.lobbyId} />;
}
