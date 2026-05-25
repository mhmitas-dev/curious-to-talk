import "server-only";
import { AccessToken } from "livekit-server-sdk";

export interface LiveKitParticipantProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface LiveKitRoomTokenInput {
  roomId: string;
  participant: LiveKitParticipantProfile;
}

export async function createRoomToken({
  roomId,
  participant,
}: LiveKitRoomTokenInput) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set");
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: participant.id,
    name: participant.displayName,
    metadata: JSON.stringify({ avatar_url: participant.avatarUrl }),
    ttl: "4h",
  });

  token.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
    canUpdateOwnMetadata: true,
  });

  return token.toJwt();
}

export function getLiveKitUrl() {
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!livekitUrl) {
    throw new Error("LIVEKIT_URL is not set");
  }

  return livekitUrl;
}
