import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");

  const userId = authData.claims.sub;
  const email = authData.claims.email;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, status, is_admin")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/login");

  const initials = profile.display_name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors hover:bg-accent"
            aria-label="Back to home"
          >
            ←
          </Link>
          <h1 className="font-semibold text-foreground tracking-tight">
            Profile Settings
          </h1>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 flex flex-col gap-6">
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-primary-foreground select-none shadow-lg"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
              boxShadow: "0 8px 32px -8px oklch(0.60 0.22 285 / 0.5)",
            }}
          >
            {initials}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground">{profile.display_name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        {/* Read-Only Account Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
            <span>👤</span> Google Account Details
          </h2>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</span>
              <span className="text-sm font-medium text-foreground">{profile.display_name}</span>
            </div>

            <div className="border-t border-border/50 pt-3 flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</span>
              <span className="text-sm font-medium text-foreground">{email}</span>
            </div>

            <div className="border-t border-border/50 pt-3 flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Authentication Provider</span>
              <span className="text-sm font-semibold text-primary flex items-center gap-1.5 select-none">
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V13.4h6.887c-.648 2.41-2.519 4.113-5.136 4.113-3.41 0-6.166-2.756-6.166-6.166 0-3.41 2.756-6.166 6.166-6.166 1.481 0 2.834.52 3.901 1.385l2.394-2.393C18.847 2.051 15.65 1 12 1 5.925 1 1 5.925 1 12s4.925 11 11 11c6.262 0 11-4.4 11-11 0-.705-.09-1.397-.245-2.093h-10.515z"/>
                </svg>
                Google OAuth
              </span>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-primary/5 border border-primary/10 p-3.5 text-[11px] leading-relaxed text-muted-foreground">
            Your name and initials are synced directly with your Google account. If you update them there, they will automatically synchronize in this app next time you sign in.
          </div>
        </div>
        
      </main>
    </div>
  );
}
