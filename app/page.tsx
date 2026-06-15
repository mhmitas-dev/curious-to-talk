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
import { PwaInstallFooterLink } from "@/components/pwa-install-prompt";
import { RoomsPresenceList } from "@/components/rooms-presence-list";
import Image from "next/image";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const voiceIconStyle = {
  background:
    "linear-gradient(135deg, color-mix(in oklch, var(--brand) 20%, transparent), color-mix(in oklch, var(--brand-deep) 14%, transparent))",
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

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5">
        <SectionHeading>Rooms</SectionHeading>

        {profile.is_admin && <CreateRoomForm />}

        {roomsWithPresence.length > 0 ? (
          <RoomsPresenceList rooms={roomsWithPresence} />
        ) : (
          <EmptyRoomsState isAdmin={profile.is_admin} />
        )}
      </main>

      <HomePhilosophy />
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
    <header className="sticky top-0 z-10 bg-card/80 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/niribi.png"
            alt="Niribi"
            width={87}
            height={35}
            priority
            className="h-7 w-auto"
          />
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
        className="border-transparent bg-[var(--button-dark)] text-primary text-xs cursor-pointer hover:bg-[color-mix(in_oklch,var(--button-dark)_86%,var(--brand)_14%)] transition-colors"
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
                "linear-gradient(135deg, var(--brand-bright), var(--brand-deep))",
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
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}

function HomePhilosophy() {
  return (
    <footer className="mx-auto w-full max-w-lg px-4 pb-7 pt-3 text-center">
      <p className="text-sm font-semibold tracking-tight text-foreground">
        Niribi
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        &ldquo;Quiet, simple, lightweight.&rdquo;
      </p>
      <div className="flex justify-center">
        <PwaInstallFooterLink />
      </div>
    </footer>
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
            "linear-gradient(135deg, color-mix(in oklch, var(--brand) 18%, transparent), color-mix(in oklch, var(--brand-deep) 12%, transparent))",
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
