import { notFound } from "next/navigation";
import { AccessToken } from "livekit-server-sdk";
import { requireApprovedProfile } from "@/lib/auth/server";
import { RoomView } from "@/components/room/room-view";

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

  // Mint a LiveKit token server-side (no extra HTTP round-trip)
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const livekitUrl = process.env.LIVEKIT_URL!;

  const token = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: profile.display_name,
    metadata: JSON.stringify({ avatar_url: profile.avatar_url }),
    ttl: "4h",
  });
  token.addGrant({
    roomJoin: true,
    room: room.id,
    canPublish: true,
    canSubscribe: true,
    // Keep browser and API-minted room tokens aligned.
    canUpdateOwnMetadata: true,
  });
  const jwt = await token.toJwt();

  return (
    <RoomView
      room={room}
      token={jwt}
      livekitUrl={livekitUrl}
      userId={userId}
      displayName={profile.display_name}
    />
  );
}
