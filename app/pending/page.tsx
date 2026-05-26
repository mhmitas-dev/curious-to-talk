import { redirect } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  getCurrentProfile,
  requireClaims,
  throwIfUnexpectedProfileError,
} from "@/lib/auth/server";

export default async function PendingPage() {
  const auth = await requireClaims();

  // If somehow an approved user lands here, send them home
  const { profile, error } = await getCurrentProfile(auth);
  throwIfUnexpectedProfileError(error);

  if (profile?.status === "approved") {
    redirect("/");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in oklch, var(--brand) 14%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Icon */}
        <div
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--brand) 22%, transparent), color-mix(in oklch, var(--brand-deep) 18%, transparent))",
            border: "1px solid color-mix(in oklch, var(--brand) 35%, transparent)",
          }}
        >
          ⏳
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Waiting for approval
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Hey{profile?.display_name ? ` ${profile.display_name}` : ""}! Your
          account is pending review. The admin will approve you shortly — come
          back and refresh once you get the go-ahead.
        </p>

        {/* Pulsing dots to show "active waiting" */}
        <div className="mt-8 flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary"
              style={{
                animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.6,
              }}
            />
          ))}
        </div>

        <form action={logout} className="mt-10">
          <Button
            type="submit"
            variant="outline"
            className="w-full h-11"
          >
            Sign out
          </Button>
        </form>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </main>
  );
}
