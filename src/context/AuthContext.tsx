// src/context/AuthContext.tsx
"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";

type Profile = {
  id: string;
  username: string | null;
  slug: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, slug")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data as Profile;
    } catch (err) {
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const handleSession = async (session: Session | null) => {
      const currentUser = session?.user ?? null;

      if (mounted) {
        setUser(currentUser);

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id);
          if (mounted) setProfile(profileData);

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
      handleSession(session);

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

  const signOut = async () => {
    // Optimistic Logout: Clear state immediately
    setProfile(null);
    setUser(null);
    router.replace('/login');

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
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

