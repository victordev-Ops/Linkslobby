"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: any[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { }
        },
      },
    }
  );
}

type ToggleResult =
  | { success: true; newStatus: "closed" | "waiting" }
  | { success: false; message: string };

export async function closeLobbyAction(lobbyId: string): Promise<ToggleResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const { data: lobby, error: fetchError } = await supabase
    .from("tod_lobbies")
    .select("id, host_id, status")
    .eq("id", lobbyId)
    .single();

  if (fetchError || !lobby) return { success: false, message: "Lobby not found" };
  if (lobby.host_id !== user.id) return { success: false, message: "Only the host can close a lobby" };
  if (lobby.status === "active") return { success: false, message: "Cannot close a lobby mid-game" };
  if (lobby.status === "finished") return { success: false, message: "Cannot close a finished lobby" };

  const { error } = await supabase
    .from("tod_lobbies")
    .update({ status: "closed" })
    .eq("id", lobbyId);

  if (error) return { success: false, message: error.message };
  return { success: true, newStatus: "closed" };
}

export async function openLobbyAction(lobbyId: string): Promise<ToggleResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const { data: lobby, error: fetchError } = await supabase
    .from("tod_lobbies")
    .select("id, host_id, status")
    .eq("id", lobbyId)
    .single();

  if (fetchError || !lobby) return { success: false, message: "Lobby not found" };
  if (lobby.host_id !== user.id) return { success: false, message: "Only the host can open a lobby" };
  if (lobby.status !== "closed") return { success: false, message: "Lobby is not closed" };

  const { error } = await supabase
    .from("tod_lobbies")
    .update({ status: "waiting" })
    .eq("id", lobbyId);

  if (error) return { success: false, message: error.message };
  return { success: true, newStatus: "waiting" };
}
