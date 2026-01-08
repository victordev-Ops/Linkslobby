// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js"; 

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
  const pathname = usePathname();
  const supabase = createClient();

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

    // 1. Initialize Session Check
    const initializeAuth = async () => {
      try {
        // Get the session immediately so we don't wait for the listener
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (mounted) setProfile(profileData);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Set up the Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      
      if (mounted) {
        setUser(currentUser);
        
        if (currentUser) {
          // If we have a user, ensure we have their profile
          const profileData = await fetchProfile(currentUser.id);
          setProfile(profileData);

          // Handle Username Setup Redirect
          // We check window.location.pathname to avoid dependency loop with 'pathname' hook
          const currentPath = window.location.pathname;
          const isSetupPage = currentPath.startsWith('/auth/setup');
          
          if (profileData && !profileData.username && !isSetupPage) {
             router.replace('/auth/setup');
          }
        } else {
          setProfile(null);
          // Only redirect on explicit sign out event
          if (event === 'SIGNED_OUT') {
             router.replace('/login'); 
          }
        }
        
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  // Removed 'pathname' and 'router' from dependencies to prevent loops
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
      
