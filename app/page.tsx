import { logout } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { CreateRoomForm } from "@/components/create-room-form";
import Link from "next/link";
import { requireApprovedProfile } from "@/lib/auth/server";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default async function HomePage() {
  const { supabase, profile } = await requireApprovedProfile();

  // Fetch rooms (will be empty for now)
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, description")
    .order("created_at", { ascending: true });

  const initials = profile.display_name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎙️</span>
            <span className="font-semibold text-foreground tracking-tight">
              Curious to Talk
            </span>
          </div>

          <div className="flex items-center gap-3">
            {profile.is_admin && (
              <a href="/admin/users">
                <Badge
                  variant="outline"
                  className="border-primary/40 text-primary text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                >
                  Admin
                </Badge>
              </a>
            )}

            {/* Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm object-cover transition-transform hover:scale-105 active:scale-95"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground select-none transition-transform hover:scale-105 active:scale-95"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
                    }}
                    title={profile.display_name}
                  >
                    {initials}
                  </div>
                )}
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
                  <DropdownMenuItem render={<button type="submit" />} className="w-full text-left cursor-pointer text-destructive focus:text-destructive">
                    Sign out
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Rooms
          </h2>
        </div>

        {/* Admin room creation form */}
        {profile.is_admin && <CreateRoomForm />}

        {rooms && rooms.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <a
                  href={`/rooms/${room.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.55 0.22 285 / 0.2), oklch(0.45 0.20 300 / 0.2))",
                      border: "1px solid oklch(0.60 0.22 285 / 0.3)",
                    }}
                  >
                    🔊
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {room.name}
                    </p>
                    {room.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {room.description}
                      </p>
                    )}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          /* ── Empty state ─────────────────────────────────── */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.55 0.22 285 / 0.15), oklch(0.45 0.20 300 / 0.15))",
                border: "1px solid oklch(0.60 0.22 285 / 0.2)",
              }}
            >
              🔇
            </div>
            <p className="font-medium text-foreground">No rooms yet</p>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs">
              {profile.is_admin
                ? "Create the first room to get the conversation started."
                : "The admin hasn't created any rooms yet. Check back soon!"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
