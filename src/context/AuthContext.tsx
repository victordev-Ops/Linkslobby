// src/context/AuthContext.tsx
"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { checkDailyLogin } from '@/actions/daily-login';
import { toast } from "sonner";
import { db, clearAllCachedData } from "@/lib/db";

type Profile = {
  id: string;
  username: string | null;
  slug: string | null;
  avatar_url?: string | null;
  is_pro?: boolean;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// How long a cached profile is trusted before we bother re-checking it in
// the background. Previously there was no TTL at all — every single cache
// hit still fired a background `profiles` query, which meant "cached" only
// saved you the *wait*, not the actual DB round trip. On the dashboard this
// query is redundant anyway once serverProfile is present (see
// DashboardClient), but AuthProvider wraps the whole app, so this still
// matters for every other authenticated page.
const PROFILE_CACHE_TTL_MS = 60_000; // 1 minute

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      // 1. Try cached profile from Dexie first
      const cached = await db.profiles.get(userId);
      if (cached) {
        const cachedProfile: Profile = { id: cached.id, username: cached.username, slug: cached.slug, is_pro: cached.is_pro };

        // Only sync in the background if the cache is actually stale.
        // Firing this unconditionally on every cache hit turned "cached"
        // into a UI-latency optimization only — the DB still took the hit
        // every time.
        const isStale = Date.now() - (cached.cached_at ?? 0) > PROFILE_CACHE_TTL_MS;
        if (isStale) {
          supabase
            .from("profiles")
            .select("id, username, slug, is_pro, avatar_url")
            .eq("id", userId)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                db.profiles.put({ ...data, cached_at: Date.now() });
                setProfile(data as Profile);
              }
            })
            .catch(() => { });
        }
        return cachedProfile;
      }

      // 2. No cache — fetch from Supabase
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, slug, is_pro, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }

      // 3. Cache the result
      if (data) {
        await db.profiles.put({ ...data, cached_at: Date.now() });
      }

      return data as Profile;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null, event?: string) => {
      const currentUser = session?.user ?? null;

      if (mounted) {
        setUser(currentUser);

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id);
          if (mounted) setProfile(profileData);

          // Daily-login check only needs to run once per real session
          // start: the initial page load, or an actual SIGNED_IN event.
          // Previously this ran on *every* onAuthStateChange event,
          // including TOKEN_REFRESHED — which Supabase fires on its own
          // roughly every ~50 minutes per open tab (and on refocus in
          // some SDK versions). That meant a server action round trip
          // firing repeatedly in the background for no reason.
          const isRealSignIn = event === undefined || event === 'SIGNED_IN' || event === 'INITIAL_SESSION';
          if (isRealSignIn) {
            checkDailyLogin().then(result => {
              if (result.success && result.awarded) {
                toast.success(result.message || "Daily Login Bonus!", {
                  description: `+${result.xp} Stars`,
                  duration: 5000
                });
              }
            });
          }

          // REMOVED: The automatic redirect logic here caused the loop.
          // We now rely on Middleware and Layouts to protect routes.
        } else {
          if (mounted) setProfile(null);
        }
        if (mounted) setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSession(session, _event);

      if (_event === 'SIGNED_OUT') {
        router.replace('/login');
        setProfile(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Online Status Heartbeat ---
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) {
      // Clear heartbeat when logged out
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      return;
    }

    const updateLastSeen = () => {
      supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
        .catch(() => {});
    };

    // Immediate update on login
    updateLastSeen();

    // Heartbeat every 60 seconds
    heartbeatRef.current = setInterval(updateLastSeen, 60 * 1000);

    // Update on tab refocus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateLastSeen();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, supabase]);

  const signOut = async () => {
    try {
      // 1. Await Supabase sign out to ensure cookies/session are cleared
      await supabase.auth.signOut();

      // 2. Clear local state
      setProfile(null);
      setUser(null);

      // 3. Clear all Dexie cached data
      await clearAllCachedData();

      // 4. Force a hard redirect to ensure complete logout
      window.location.href = '/login';

    } catch (error) {
      console.error("Error signing out:", error);
      // Fallback: Clear state and redirect even if Supabase call fails
      setProfile(null);
      setUser(null);
      await clearAllCachedData().catch(() => { });
      window.location.href = '/login';
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id);
      setProfile(data);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During SSR, the context may not be available yet.
    // Return a safe neutral object or null to prevent crashes.
    if (typeof window === 'undefined') {
      return { user: null, profile: null, loading: true, signOut: async () => { }, refreshProfile: async () => { } }
    }
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
