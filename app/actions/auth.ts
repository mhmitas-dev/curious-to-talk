"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────
export type AuthState = { error: string } | undefined;

// ── Register ─────────────────────────────────────────────────
export async function register(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const displayName = (formData.get("display_name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!displayName || displayName.length < 2) {
    return { error: "Display name must be at least 2 characters." };
  }
  if (!email) {
    return { error: "Email is required." };
  }
  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The trigger reads this to set display_name on the profile row
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Profile is created automatically by the database trigger.
  // New users start as 'pending' — redirect them to the waiting screen.
  redirect("/pending");
}

// ── Login ─────────────────────────────────────────────────────
export async function login(
  _state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Invalid email or password." };
  }

  // Check approval status
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .single();

  if (profile?.status === "pending") {
    redirect("/pending");
  }

  redirect("/");
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
