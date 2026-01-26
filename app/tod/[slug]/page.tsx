import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import TODGameClient from "@/components/tod/TODGameClient";

// Next.js 15+ - params is a Promise
export default async function TODGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // Await both params and cookies
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
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
    redirect(`/login?next=/tod/${slug}`);
  }

  // 1. Resolve Slug/ID to Lobby UUID
  let lobbyId = slug;

  // Check if slug is a valid UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  const { data: lobbyData } = await supabase
    .from("tod_lobbies")
    .select("id")
    .or(`slug.eq."${slug}",id.eq."${isUUID ? slug : '00000000-0000-0000-0000-000000000000'}"`)
    .maybeSingle();

  if (!lobbyData) {
    // Fallback if not found
    redirect('/tod?error=lobby_not_found');
  }

  lobbyId = lobbyData.id;

  // 2. Auto-Join Logic (Server-side) using resolved lobbyId
  if (lobbyId) {
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

