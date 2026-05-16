import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateRoomForm } from "@/components/create-room-form";

export default async function HomePage() {
  const supabase = await createClient();

  // Proxy already redirects unauthenticated users to /login,
  // but we double-check and fetch the profile in one query.
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");

  const userId = authData.claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_admin, status")
    .eq("id", userId)
    .single();


  if (!profile || profile.status === "pending") {
    redirect("/pending");
  }

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

            {/* Avatar */}
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground select-none"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
              }}
              title={profile.display_name}
            >
              {initials}
            </div>

            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs"
              >
                Sign out
              </Button>
            </form>
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
