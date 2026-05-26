import { NextResponse } from "next/server";
import { getApprovedAuthForApi } from "@/lib/auth/server";
import { getLiveKitRoomParticipantCounts } from "@/lib/livekit/server";

const MAX_ROOM_IDS = 100;

interface PresenceRequestBody {
  roomIds?: unknown;
}

function parseRoomIds(body: PresenceRequestBody) {
  if (!Array.isArray(body.roomIds)) {
    return null;
  }

  const roomIds = body.roomIds
    .filter((roomId): roomId is string => typeof roomId === "string")
    .map((roomId) => roomId.trim())
    .filter(Boolean);

  return Array.from(new Set(roomIds)).slice(0, MAX_ROOM_IDS);
}

export async function POST(request: Request) {
  try {
    const auth = await getApprovedAuthForApi();
    if (auth.status === "unauthenticated") {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    if (auth.status === "forbidden") {
      return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
    }

    let body: PresenceRequestBody;
    try {
      body = (await request.json()) as PresenceRequestBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const requestedRoomIds = parseRoomIds(body);
    if (!requestedRoomIds) {
      return NextResponse.json({ error: "roomIds must be an array" }, { status: 400 });
    }

    if (requestedRoomIds.length === 0) {
      return NextResponse.json(
        { counts: {}, updatedAt: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const { data: rooms, error } = await auth.supabase
      .from("rooms")
      .select("id")
      .in("id", requestedRoomIds);

    if (error) {
      throw error;
    }

    const allowedRoomIds = rooms?.map((room) => room.id as string) ?? [];
    const participantCounts = await getLiveKitRoomParticipantCounts(allowedRoomIds);

    return NextResponse.json(
      {
        counts: Object.fromEntries(participantCounts),
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Room presence lookup failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
