"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RoomState = { error: string } | undefined;

export async function createRoom(
  _state: RoomState,
  formData: FormData
): Promise<RoomState> {
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Room name must be at least 2 characters." };
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();

  if (!authData?.claims) redirect("/login");

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.claims.sub)
    .single();

  if (!profile?.is_admin) {
    return { error: "Only admins can create rooms." };
  }

  const { error } = await supabase.from("rooms").insert({
    name,
    description,
    created_by: authData.claims.sub,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
}
