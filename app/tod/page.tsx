// app/tod/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { CreateLobbyButton } from "@/components/tod/ui/CreateLobbyButton";
import { LobbyCard } from "@/components/tod/ui/LobbyCard";
import { Sparkles, Users } from "lucide-react";

export default async function TODDashboardPage() {
  const cookieStore = await cookies();

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login`);
  }

  // Fetch user's active lobbies
  const { data: userLobbies, error: lobbiesError } = await supabase
    .from("tod_participants")
    .select(
      `
      lobby_id,
      tod_lobbies (
        id,
        host_id,
        status,
        created_at,
        updated_at,
        profiles:host_id (username)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Count participants for each lobby
  const lobbiesWithCounts = await Promise.all(
    (userLobbies || []).map(async (item: any) => {
      const lobby = item.tod_lobbies;
      if (!lobby) return null;

      const { count } = await supabase
        .from("tod_participants")
        .select("*", { count: "exact", head: true })
        .eq("lobby_id", lobby.id);

      return {
        lobbyId: lobby.id,
        playerCount: count || 0,
        status: lobby.status,
        isHost: lobby.host_id === user.id,
        lastActivity: lobby.updated_at || lobby.created_at,
        hostUsername: lobby.profiles?.username || "Unknown",
      };
    })
  );

  const validLobbies = lobbiesWithCounts.filter((l) => l !== null);

  const activeLobbies = validLobbies.filter(
    (l) => l.status === "waiting" || l.status === "active"
  );
  const finishedLobbies = validLobbies.filter((l) => l.status === "finished");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-rose-950 to-slate-950 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-rose-500 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-500 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-rose-500/20 to-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
              <Sparkles size={32} className="text-rose-400" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-2 italic">
              Truth or Dare
            </h1>
            <p className="text-slate-400 text-lg">
              Create a game or join your active lobbies
            </p>
          </div>

          {/* Create Lobby Button */}
          <div className="mb-8">
            <CreateLobbyButton userId={user.id} />
          </div>

          {/* Active Lobbies */}
          {activeLobbies.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-rose-400" />
                Active Games ({activeLobbies.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeLobbies.map((lobby) => (
                  <LobbyCard key={lobby.lobbyId} {...lobby} />
                ))}
              </div>
            </div>
          )}

          {/* Finished Lobbies */}
          {finishedLobbies.length > 0 && (
            <div>
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users size={20} className="text-slate-400" />
                Recent Games ({finishedLobbies.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {finishedLobbies.map((lobby) => (
                  <LobbyCard key={lobby.lobbyId} {...lobby} />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {activeLobbies.length === 0 && finishedLobbies.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-slate-500" />
              </div>
              <p className="text-slate-400 text-lg">No games yet</p>
              <p className="text-slate-500 text-sm mt-2">
                Create your first game to get started!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
                    }
