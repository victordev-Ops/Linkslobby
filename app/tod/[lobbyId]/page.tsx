import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "./TODGameClient";

// Next.js 15+ Params are Promises
export default async function TODPage({ 
  params 
}: { 
  params: Promise<{ lobbyId: string }> 
}) {
  const resolvedParams = await params;
  const lobbyId = resolvedParams.lobbyId;
  const cookieStore = await cookies();

  // Initialize Supabase Server Client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
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

  // Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect(`/login?next=/tod/${lobbyId}`);
  }

  // Auto-Join / Verification
  if (lobbyId && lobbyId !== "undefined") {
    // Upsert participant to ensure they are in the list
    const { error: joinError } = await supabase
      .from("tod_participants")
      .upsert(
        { lobby_id: lobbyId, user_id: user.id },
        { onConflict: 'lobby_id,user_id' }
      );

    if (joinError) {
      console.error("Error joining lobby:", joinError.message);
      // Handle error gracefully if needed
    }
  }

  return (
    <main className="h-[100dvh] w-full bg-[#F8F9FD] overflow-hidden">
      <TODGameClient lobbyId={lobbyId} />
    </main>
  );
}
  
