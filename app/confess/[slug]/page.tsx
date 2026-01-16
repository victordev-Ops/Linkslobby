import { notFound } from "next/navigation";
// 1. Corrected import name to match your server.ts file
import { createSupabaseServerClient } from "@/lib/supabase/server"; 
import ConfessionForm from "./ConfessionForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
// Force Next.js to always fetch fresh data from Supabase
export const revalidate = 0;

export default async function ConfessionPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  
  // 2. Await the async server client creator
  const supabase = await createSupabaseServerClient();

  // 3. Fetch the profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, slug")
    .eq("slug", slug)
    .single();

  if (error || !profile) {
    notFound();
  }

  /**
   * SERVER ACTION
   */
  async function submitConfession(profileId: string, formData: FormData) {
    "use server";
    
    const message = formData.get("message") as string;
    // Call the server client inside the action as well
    const supabaseAction = await createSupabaseServerClient();

    if (!message || message.length < 1) {
      return { error: "Message cannot be empty." };
    }

    const { error: insertError } = await supabaseAction
      .from("messages")
      .insert([
        {
          profile_id: profileId,
          content: message,
        },
      ]);

    if (insertError) {
      console.error("Submission error:", insertError);
      return { error: "Failed to send message." };
    }

    return { success: true };
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2.5rem] bg-gradient-to-tr from-purple-600 to-blue-500 p-[2px]">
            <div className="w-full h-full rounded-[2.4rem] bg-black flex items-center justify-center">
              <span className="text-2xl font-bold tracking-tighter italic">S</span>
            </div>
          </div>
          
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight">
              Send a secret to @{profile.username}
            </h1>
            <p className="text-neutral-500 text-sm">
              They will never know who sent it.
            </p>
          </div>
        </div>

        <div className="bg-neutral-900/30 border border-white/5 rounded-[2rem] p-6 backdrop-blur-sm">
          <ConfessionForm profileId={profile.id} action={submitConfession} />
        </div>

        <div className="mt-12 text-center">
          <Link 
            href="/signup" 
            className="text-xs font-bold text-neutral-500 hover:text-purple-400 transition-colors tracking-widest uppercase"
          >
            Create your own anonymous page →
          </Link>
        </div>
      </div>
    </div>
  );
}
