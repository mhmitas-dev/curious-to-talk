import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { AdminRoomsList } from "@/components/admin-rooms-list";

export default async function AdminRoomsPage() {
  const supabase = await createClient();

  // Verify admin (defence in depth)
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");

  const { data: caller } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.claims.sub)
    .single();

  if (!caller?.is_admin) redirect("/");

  // Fetch all rooms from DB
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, description")
    .order("created_at", { ascending: true });

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to home"
          >
            ←
          </Link>
          <h1 className="font-semibold text-foreground tracking-tight">
            Rooms
          </h1>
          <Badge
            variant="outline"
            className="border-primary/40 text-primary text-xs ml-1"
          >
            Admin
          </Badge>
        </div>
      </header>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-border bg-card/25">
        <div className="mx-auto flex max-w-lg px-4">
          <Link
            href="/admin/users"
            className="flex-1 border-b-2 border-transparent py-3 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Users
          </Link>
          <Link
            href="/admin/rooms"
            className="flex-1 border-b-2 border-primary py-3 text-center text-xs font-semibold text-foreground transition-colors"
          >
            Rooms
          </Link>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 space-y-6">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Manage Voice Rooms ({rooms?.length ?? 0})
          </h2>
          <AdminRoomsList rooms={rooms || []} />
        </section>
      </main>
    </div>
  );
}
