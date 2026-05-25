import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ProfileStatus = "pending" | "approved";

export interface AuthProfile {
  id: string;
  display_name: string;
  is_admin: boolean;
  status: ProfileStatus;
  avatar_url: string | null;
}

export async function getOptionalClaims() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    return null;
  }

  return {
    supabase,
    claims: data.claims,
    userId: data.claims.sub,
  };
}

export type AuthContext = NonNullable<
  Awaited<ReturnType<typeof getOptionalClaims>>
>;

export function isMissingProfileError(error: { code?: string } | null) {
  return error?.code === "PGRST116";
}

export function throwIfUnexpectedProfileError(
  error: { code?: string } | null
) {
  if (error && !isMissingProfileError(error)) {
    throw error;
  }
}

export async function requireClaims() {
  const auth = await getOptionalClaims();

  if (!auth) {
    redirect("/login");
  }

  return auth;
}

export async function getCurrentProfile(auth: AuthContext) {
  const { data: profile, error } = await auth.supabase
    .from("profiles")
    .select("id, display_name, is_admin, status, avatar_url")
    .eq("id", auth.userId)
    .single();

  return {
    profile: profile as AuthProfile | null,
    error,
  };
}

export async function requireAdminProfile() {
  const auth = await requireClaims();
  const { profile, error } = await getCurrentProfile(auth);
  throwIfUnexpectedProfileError(error);

  if (!profile?.is_admin) {
    redirect("/");
  }

  return {
    ...auth,
    profile,
  };
}

export async function getAdminAuthForAction() {
  const auth = await requireClaims();
  const { profile, error } = await getCurrentProfile(auth);
  throwIfUnexpectedProfileError(error);

  if (!profile?.is_admin) {
    return null;
  }

  return {
    ...auth,
    profile,
  };
}

export async function getApprovedAuthForApi() {
  const auth = await getOptionalClaims();

  if (!auth) {
    return { status: "unauthenticated" as const };
  }

  const { profile, error } = await getCurrentProfile(auth);
  throwIfUnexpectedProfileError(error);

  if (!profile || profile.status !== "approved") {
    return { ...auth, status: "forbidden" as const };
  }

  return {
    ...auth,
    profile,
    status: "ok" as const,
  };
}

export async function requireApprovedProfile() {
  const auth = await requireClaims();
  const { profile, error } = await getCurrentProfile(auth);
  throwIfUnexpectedProfileError(error);

  if (!profile || profile.status !== "approved") {
    redirect("/pending");
  }

  return {
    ...auth,
    profile,
  };
}
