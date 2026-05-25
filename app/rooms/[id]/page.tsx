import { notFound } from "next/navigation";
import { requireApprovedProfile } from "@/lib/auth/server";
import { RoomView } from "@/components/room/room-view";
import { createRoomToken, getLiveKitUrl } from "@/lib/livekit/server";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RoomPage({ params }: Props) {
  const { id } = await params;

  const { supabase, userId, profile } = await requireApprovedProfile();

  // Fetch the room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, description")
    .eq("id", id)
    .single();

  if (!room) notFound();

  const livekitUrl = getLiveKitUrl();
  const jwt = await createRoomToken({
    roomId: room.id,
    participant: {
      id: userId,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
    },
  });

  return (
    <RoomView
      token={jwt}
      livekitUrl={livekitUrl}
      userId={userId}
    />
  );
}
