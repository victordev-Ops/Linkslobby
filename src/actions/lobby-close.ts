// src/actions/lobby-close.ts
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // @ts-ignore — Next 15 cookies() is sync here
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: any[]) {
          try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { }
        },
      },
    }
  );
}

/**
 * Toggle a lobby's open/closed state.
 * "Closed" means is_private = true AND status = 'waiting' with a special flag,
 * but since the schema has no dedicated `is_closed` column we repurpose the
 * existing `status` field:  'closed' (new value we add) vs 'waiting' / 'active'.
 *
 * NOTE: If you prefer not to change the status enum, add a boolean `is_closed`
 * column to `tod_lobbies` and update the references below accordingly.
 * The action below uses `status = 'closed'` as the closed sentinel so it works
 * without a schema migration — but you should add 'closed' to the status CHECK
 * constraint in Supabase:
 *   ALTER TABLE tod_lobbies DROP CONSTRAINT IF EXISTS tod_lobbies_status_check;
 *   ALTER TABLE tod_lobbies ADD CONSTRAINT tod_lobbies_status_check
 *     CHECK (status = ANY(ARRAY['waiting','active','finished','closed']));
 *
 * OR — preferred clean approach — add a dedicated column (recommended):
 *   ALTER TABLE tod_lobbies ADD COLUMN is_closed boolean DEFAULT false;
 * Then swap the two status lines below for:
 *   .update({ is_closed: true })  /  .update({ is_closed: false })
 */

type ToggleResult =
  | { success: true; newStatus: "closed" | "waiting" }
  | { success: false; message: string };

export async function closeLobbyAction(lobbyId: string): Promise<ToggleResult> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  // Verify caller is the host
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
  const supabase = createClient();

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
