import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "./TODGameClient";

export default async function TODPage({ params }: { params: { lobbyId: string } }) {
  // 1. Await cookies() - This is the fix for Next.js 15/16
  const cookieStore = await cookies();
  const { lobbyId } = params;

  // 2. Initialize Supabase Server Client
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
            // This can be ignored if middleware is handling session refreshes
          }
        },
      },
    }
  );

  // 3. Auth Check
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/tod/${lobbyId}`);
  }

  // 4. Auto-Join Logic (Server-side)
  // Ensures the user is in the participants list before the client even loads
  await supabase
    .from("tod_participants")
    .upsert(
      { lobby_id: lobbyId, user_id: user.id },
      { onConflict: 'lobby_id,user_id' }
    );

  return (
    <main className="min-h-screen bg-[#F8F9FD]">
      <TODGameClient lobbyId={lobbyId} />
    </main>
  );
}
