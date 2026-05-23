import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Inline server action — called from the approve form
async function approveUser(formData: FormData) {
  "use server";
  const userId = formData.get("userId") as string;
  if (!userId) return;

  const supabase = await createClient();

  // Verify admin (defence in depth — layout already guards this route)
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");

  const { data: caller } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", authData.claims.sub)
    .single();

  if (!caller?.is_admin) redirect("/");

  await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", userId);

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const supabase = await createClient();

  // Fetch all profiles — admin RLS policy allows this
  const { data: users } = await supabase
    .from("profiles")
    .select("id, display_name, is_admin, status, created_at")
    .order("created_at", { ascending: true });

  const pending = users?.filter((u) => u.status === "pending") ?? [];
  const approved = users?.filter((u) => u.status === "approved") ?? [];

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
            Users
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
            className="flex-1 border-b-2 border-primary py-3 text-center text-xs font-semibold text-foreground transition-colors"
          >
            Users
          </Link>
          <Link
            href="/admin/rooms"
            className="flex-1 border-b-2 border-transparent py-3 text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Rooms
          </Link>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 space-y-8">

        {/* ── Pending section ─────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Pending approval
            </h2>
            {pending.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {pending.length}
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No pending requests 🎉
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pending.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  {/* Avatar */}
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground select-none"
                    style={{
                      background:
                        "linear-gradient(135deg, oklch(0.55 0.22 285 / 0.5), oklch(0.45 0.20 300 / 0.5))",
                    }}
                  >
                    {user.display_name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined{" "}
                      {new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <form action={approveUser}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs font-semibold"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
                      }}
                    >
                      Approve
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator className="opacity-50" />

        {/* ── Approved section ────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Approved ({approved.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {approved.map((user) => (
              <li
                key={user.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-4"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground select-none"
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
                  }}
                >
                  {user.display_name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.is_admin ? "Admin · " : ""}Approved
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-green-500/30 text-green-400 text-[10px]"
                >
                  ✓ Active
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
