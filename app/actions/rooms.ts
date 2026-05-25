"use server";

import { revalidatePath } from "next/cache";
import { getAdminAuthForAction } from "@/lib/auth/server";

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

  const auth = await getAdminAuthForAction();
  if (!auth) {
    return { error: "Only admins can create rooms." };
  }

  const { error } = await auth.supabase.from("rooms").insert({
    name,
    description,
    created_by: auth.userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
}

export async function deleteRoom(
  _state: RoomState,
  formData: FormData
): Promise<RoomState> {
  const roomId = formData.get("roomId") as string;
  if (!roomId) return { error: "Room ID is required." };

  const auth = await getAdminAuthForAction();
  if (!auth) {
    return { error: "Only admins can delete rooms." };
  }

  const { error } = await auth.supabase.from("rooms").delete().eq("id", roomId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/rooms");
}

export async function renameRoom(
  _state: RoomState,
  formData: FormData
): Promise<RoomState> {
  const roomId = formData.get("roomId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!roomId) return { error: "Room ID is required." };
  if (!name || name.length < 2) {
    return { error: "Room name must be at least 2 characters." };
  }

  const auth = await getAdminAuthForAction();
  if (!auth) {
    return { error: "Only admins can rename rooms." };
  }

  const { error } = await auth.supabase
    .from("rooms")
    .update({ name, description })
    .eq("id", roomId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/rooms");
}
