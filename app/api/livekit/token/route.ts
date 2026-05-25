import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { getApprovedAuthForApi } from "@/lib/auth/server";

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

    // ── Generate LiveKit token ───────────────────────────────
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error("LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not set");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: auth.userId,          // unique participant ID (Supabase user ID)
      name: auth.profile.display_name, // display name shown to other participants
      metadata: JSON.stringify({ avatar_url: auth.profile.avatar_url }),
      ttl: "4h",                  // token expires after 4 hours
    });

    token.addGrant({
      roomJoin: true,
      room: room.id,      // use the room's UUID as the LiveKit room name
      canPublish: true,   // participant can share their microphone
      canSubscribe: true, // participant can hear others
      canUpdateOwnMetadata: true, // participant can share youtube links, etc.
    });

    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      url: process.env.LIVEKIT_URL,
      roomName: room.name,
    });
  } catch (err) {
    console.error("Token generation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
