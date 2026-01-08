"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js"; 

type Profile = {
  id: string;
  username: string | null; // Username might be null initially
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
        .maybeSingle(); // maybeSingle returns null instead of throwing on 0 rows

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        setProfile(profileData);

        // LOGIC: If profile exists but has NO username, they must go to setup.
        // We check 'pathname' to avoid an infinite redirect loop if they are already there.
        const isSetupPage = pathname?.startsWith('/auth/setup');
        
        if (profileData && !profileData.username && !isSetupPage) {
           router.replace('/auth/setup');
        }
      } else {
        setProfile(null);
        if (event === 'SIGNED_OUT' && pathname !== '/login') {
             router.replace('/login'); 
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, router, pathname]);

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
    
