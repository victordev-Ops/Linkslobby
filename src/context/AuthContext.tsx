"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  username: string | null;
  slug: string;
  email: string;
};

type AuthContextType = {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>; // Added this to help with onboarding
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  // Helper to fetch profile data
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(); // maybeSingle() returns null instead of throwing if row is missing

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data;
    } catch (err) {
      console.error("Unexpected profile fetch error:", err);
      return null;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Get initial session
        const { data: { user: activeUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.warn("No active session found");
        }

        setUser(activeUser);

        if (activeUser) {
          const profileData = await fetchProfile(activeUser.id);
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        // This MUST run to break the infinite loading state
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes (Login, Logout, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
      router.push("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  // Useful to call this after a user finishes onboarding
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
