import { NextResponse } from "next/server";
import { getApprovedAuthForApi } from "@/lib/auth/server";
import { createRoomToken, getLiveKitUrl } from "@/lib/livekit/server";

export async function POST(request: Request) {
  try {
    // ── Auth check ──────────────────────────────────────────
    const auth = await getApprovedAuthForApi();
    if (auth.status === "unauthenticated") {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
    if (auth.status === "forbidden") {
      return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
    }

    // ── Parse request body ───────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const roomId =
      body && typeof body === "object" && "roomId" in body
        ? (body as { roomId?: unknown }).roomId
        : undefined;

    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    // Verify the room exists in the DB
    const { data: room } = await auth.supabase
      .from("rooms")
      .select("id, name")
      .eq("id", roomId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const token = await createRoomToken({
      roomId: room.id,
      participant: {
        id: auth.userId,
        displayName: auth.profile.display_name,
        avatarUrl: auth.profile.avatar_url,
      },
    });
    const livekitUrl = getLiveKitUrl();

    return NextResponse.json({
      token,
      url: livekitUrl,
      roomName: room.name,
    });
  } catch (err) {
    console.error("Token generation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
