import { logout } from "@/app/actions/auth";
import { requireApprovedProfile, type AuthProfile } from "@/lib/auth/server";
import { getLiveKitRoomParticipantCounts } from "@/lib/livekit/server";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CreateRoomForm } from "@/components/create-room-form";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UsersRound } from "lucide-react";

interface Room {
  id: string;
  name: string;
  description: string | null;
  participantCount: number;
}

const voiceIconStyle = {
  background:
    "linear-gradient(135deg, oklch(0.55 0.22 285 / 0.2), oklch(0.45 0.20 300 / 0.2))",
  border: "1px solid oklch(0.60 0.22 285 / 0.3)",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function HomePage() {
  const { supabase, profile } = await requireApprovedProfile();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, description")
    .order("created_at", { ascending: true });
  const roomRows = rooms ?? [];
  const participantCounts = await getRoomParticipantCounts(roomRows.map((room) => room.id));
  const roomsWithPresence = roomRows.map((room) => ({
    ...room,
    participantCount: participantCounts.get(room.id) ?? 0,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <HomeHeader profile={profile} />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <SectionHeading>Rooms</SectionHeading>

        {profile.is_admin && <CreateRoomForm />}

        {roomsWithPresence.length > 0 ? (
          <RoomsList rooms={roomsWithPresence} />
        ) : (
          <EmptyRoomsState isAdmin={profile.is_admin} />
        )}
      </main>
    </div>
  );
}

async function getRoomParticipantCounts(roomIds: string[]) {
  try {
    return await getLiveKitRoomParticipantCounts(roomIds);
  } catch (error) {
    console.error("Failed to load LiveKit room participant counts", error);
    return new Map<string, number>();
  }
}

function HomeHeader({ profile }: { profile: AuthProfile }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            🎙️
          </span>
          <span className="font-semibold text-foreground tracking-tight">
            Curious to Talk
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {profile.is_admin && <AdminLink />}
          <ProfileMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}

function AdminLink() {
  return (
    <Link href="/admin/users">
      <Badge
        variant="outline"
        className="border-primary/40 text-primary text-xs cursor-pointer hover:bg-primary/10 transition-colors"
      >
        Admin
      </Badge>
    </Link>
  );
}

function ProfileMenu({ profile }: { profile: AuthProfile }) {
  const initials = getInitials(profile.display_name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <Avatar className="h-8 w-8 shadow-sm transition-transform hover:scale-105 active:scale-95">
          {profile.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt={profile.display_name} />
          )}
          <AvatarFallback
            className="text-xs font-semibold text-primary-foreground"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <div className="px-2 py-1.5 text-sm font-medium">
          {profile.display_name}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />} className="cursor-pointer">
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem
            render={<button type="submit" />}
            className="w-full text-left cursor-pointer text-destructive focus:text-destructive"
          >
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}

function RoomsList({ rooms }: { rooms: Room[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {rooms.map((room) => (
        <li key={room.id}>
          <RoomListItem room={room} />
        </li>
      ))}
    </ul>
  );
}

function RoomListItem({ room }: { room: Room }) {
  const hasParticipants = room.participantCount > 0;
  const participantLabel =
    room.participantCount > 99 ? "99+ here" : `${room.participantCount} here`;

  return (
    <Link
      href={`/rooms/${room.id}`}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
        style={voiceIconStyle}
      >
        🔊
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground truncate">{room.name}</p>
        {room.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {room.description}
          </p>
        )}
      </div>
      <div
        className={`flex min-w-[4.75rem] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
          hasParticipants
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        }`}
        aria-label={`${room.participantCount} participant${
          room.participantCount === 1 ? "" : "s"
        } in ${room.name}`}
        title={`${room.participantCount} participant${
          room.participantCount === 1 ? "" : "s"
        } in ${room.name}`}
      >
        <UsersRound className="h-3.5 w-3.5" />
        <span>{hasParticipants ? participantLabel : "Empty"}</span>
      </div>
    </Link>
  );
}

function EmptyRoomsState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
        style={{
          ...voiceIconStyle,
          background:
            "linear-gradient(135deg, oklch(0.55 0.22 285 / 0.15), oklch(0.45 0.20 300 / 0.15))",
          border: "1px solid oklch(0.60 0.22 285 / 0.2)",
        }}
      >
        🔇
      </div>
      <p className="font-medium text-foreground">No rooms yet</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        {isAdmin
          ? "Create the first room to get the conversation started."
          : "The admin hasn't created any rooms yet. Check back soon!"}
      </p>
    </div>
  );
}
