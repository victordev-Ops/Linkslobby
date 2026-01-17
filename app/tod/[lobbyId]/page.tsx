import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "./TODGameClient";

// 1. In Next.js 15+, params is a Promise
export default async function TODPage({ 
  params 
}: { 
  params: Promise<{ lobbyId: string }> 
}) {
  // 2. Await both params and cookies
  const resolvedParams = await params;
  const lobbyId = resolvedParams.lobbyId;
  const cookieStore = await cookies();

  // 3. Initialize Supabase Server Client
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

  // 4. Auth Check
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/tod/${lobbyId}`);
  }

  // 5. Auto-Join Logic (Server-side)
  // Ensure the lobbyId exists and is valid before upserting
  if (lobbyId && lobbyId !== "undefined") {
    const { error: joinError } = await supabase
      .from("tod_participants")
      .upsert(
        { lobby_id: lobbyId, user_id: user.id },
        { onConflict: 'lobby_id,user_id' }
      );
    
    if (joinError) {
      console.error("Error joining lobby:", joinError.message);
      // Optional: redirect to dashboard if lobby doesn't exist
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FD]">
      {/* Pass the strictly resolved string */}
      <TODGameClient lobbyId={lobbyId} />
    </main>
  );
}
