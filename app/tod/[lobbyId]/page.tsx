import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "@/components/tod/TODGameClient";

// Next.js 15+ - params is a Promise
export default async function TODGamePage({
  params,
}: {
  params: Promise<{ lobbyId: string }>;
}) {
  // Await both params and cookies
  const resolvedParams = await params;
  const lobbyId = resolvedParams.lobbyId;
  const cookieStore = await cookies();

  // Initialize Supabase Server Client
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

  // Auth Check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/tod/${lobbyId}`);
  }

  // Auto-Join Logic (Server-side)
  if (lobbyId && lobbyId !== "undefined") {
    const { error: joinError } = await supabase
      .from("tod_participants")
      .upsert(
        { lobby_id: lobbyId, user_id: user.id },
        { onConflict: "lobby_id,user_id" }
      );

    if (joinError) {
      console.error("Error joining lobby:", joinError.message);
    }
  }

  return <TODGameClient lobbyId={lobbyId} />;
    }
                              
