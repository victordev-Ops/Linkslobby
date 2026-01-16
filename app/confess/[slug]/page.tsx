// app/confess/[slug]/page.tsx
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server"; 
import ConfessionForm from "./ConfessionForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

// In Next.js 15/16, params is a Promise
type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ConfessionPage({ params }: Props) {
  // 1. You MUST await params before using slug
  const { slug } = await params;
  
  const supabase = await createSupabaseServerClient();

  // 2. Fetch the profile using the awaited slug
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, slug")
    .eq("slug", slug.toLowerCase()) // Database has lowercase 'geneviv'
    .maybeSingle();

  // 3. If no profile, it triggers the 404
  if (error || !profile) {
    console.error("404 Error: Profile not found for slug:", slug);
    notFound();
  }

  /**
   * SERVER ACTION
   */
  async function submitConfession(profileId: string, formData: FormData) {
    "use server";
    const message = formData.get("message") as string;
    const supabaseAction = await createSupabaseServerClient();

    if (!message || message.length < 1) return { error: "Message is empty." };

    const { error: insertError } = await supabaseAction
      .from("messages")
      .insert([{ profile_id: profileId, content: message }]);

    if (insertError) return { error: "Failed to send." };
    return { success: true };
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-black">Send a secret to @{profile.username}</h1>
          <p className="text-neutral-500 text-sm">Anonymous & Encrypted</p>
        </div>

        <div className="bg-neutral-900/30 border border-white/5 rounded-[2rem] p-6">
          <ConfessionForm profileId={profile.id} action={submitConfession} />
        </div>
      </div>
    </div>
  );
}
