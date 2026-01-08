// @/context/AuthContext.tsx

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js"; // Import Supabase User type

// --- Types ---
type Profile = {
  id: string;
  username: string | null;
  slug: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
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
        .select("id, username, slug, email")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.error("Unexpected profile fetch error:", err);
      return null;
    }
  };

  // --- Core State Management (useEffect) ---
  useEffect(() => {
    // Rely solely on the onAuthStateChange listener for initial load and subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      // Update User State
      setUser(currentUser);
      
      // Update Profile State
      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);
        
        // Safety Redirect: User logged in, but profile row is missing -> Send to setup
        if (!profileData && event !== 'SIGNED_OUT') {
            router.push('/auth/setup');
        }

      } else {
        setProfile(null);
        
        // Safety Redirect: If explicitly logged out, ensure they go to the login page
        if (event === 'SIGNED_OUT' && window.location.pathname !== '/login') {
             // Change '/login' to your correct login route if different
             router.push('/login'); 
        }
      }
      
      // Crucial: Set loading to false only after the initial state is processed
      setLoading(false);
    });

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
  }, [supabase, router]); // Dependency on router is necessary for the push calls

  // --- Action Handlers ---

  const signOut = async () => {
    try {
      // Calling this triggers the onAuthStateChange listener, 
      // which handles state clearing and redirect automatically.
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
  
