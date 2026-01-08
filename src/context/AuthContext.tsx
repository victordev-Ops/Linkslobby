// @/context/AuthContext.tsx

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js"; // Import Supabase User type for better typing

// --- Types ---
type Profile = {
  id: string;
  username: string | null;
  slug: string;
  email: string;
};

type AuthContextType = {
  user: User | null; // Use Supabase's User type
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Auth Provider Component ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Start as true
  const router = useRouter();
  const supabase = createClient();

  // Helper to fetch profile data
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, slug, email") // Specify columns for Profile type
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data as Profile; // Cast data to Profile type
    } catch (err) {
      console.error("Unexpected profile fetch error:", err);
      return null;
    }
  };

  // --- Core State Management (useEffect) ---
  useEffect(() => {
    // 1. Listen for auth changes (Login, Logout, Token Refresh, Initial Load)
    // The onAuthStateChange listener is the most reliable source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      // Update User State
      setUser(currentUser);
      
      // Update Profile State
      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);
        
        // --- Added Redirect Check ---
        // If the user is logged in but has no profile, redirect them to setup
        // This makes sure the user is never stuck on a page that needs a profile (e.g., /dashboard)
        if (!profileData && event !== 'SIGNED_OUT') {
            router.push('/auth/setup');
        }

      } else {
        setProfile(null);
        // If logged out, redirect to login page only if not already there
        if (event === 'SIGNED_OUT') {
            router.push('/login');
        }
      }
      
      // Crucial: Set loading to false ONLY after the initial state is processed
      // This is safe because onAuthStateChange fires immediately with the current session.
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
    // Removed dependency on router since it's stable and causes issues in some Next.js environments
  }, [supabase]); // Depend only on supabase client

  // --- Action Handlers ---

  const signOut = async () => {
    try {
      // The listener handles the state clearing and redirect.
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const data = await fetchProfile(user.id);
      setProfile(data);
    }
  };

  // --- Provider Return ---
  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
