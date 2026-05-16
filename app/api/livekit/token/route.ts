import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // ── Auth check ──────────────────────────────────────────
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getClaims();

    if (!authData?.claims) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const userId = authData.claims.sub;

    // Verify the user is approved (not just logged in)
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, status")
      .eq("id", userId)
      .single();

    if (!profile || profile.status !== "approved") {
      return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
    }

    // ── Parse request body ───────────────────────────────────
    const { roomId } = await request.json();

    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    // Verify the room exists in the DB
    const { data: room } = await supabase
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
      identity: userId,          // unique participant ID (Supabase user ID)
      name: profile.display_name, // display name shown to other participants
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
