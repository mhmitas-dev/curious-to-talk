"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string } | undefined;

// ── Google Sign In ────────────────────────────────────────────
export async function signInWithGoogle(): Promise<AuthState> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data?.url) {
    redirect(data.url);
  }

  return { error: "Failed to generate Google Sign-in URL." };
}

// ── Logout ────────────────────────────────────────────────────
export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ── Approve user (admin only) ─────────────────────────────────
export async function approveUser(userId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Verify the caller is an admin
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .single();

  if (!callerProfile?.is_admin) {
    return { error: "Unauthorised." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/users");
  return {};
}
