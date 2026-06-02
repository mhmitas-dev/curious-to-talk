"use client";

import { useActionState } from "react";
import { signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [state, action, isPending] = useActionState(signInWithGoogle, undefined);

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--brand) 18%, transparent) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--brand-bright), var(--brand-deep))",
              boxShadow:
                "0 0 32px color-mix(in oklch, var(--brand) 40%, transparent)",
            }}
          >
            🎙️
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Niribi
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sign in to join the conversation
            </p>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-border bg-card p-6 shadow-2xl"
          style={{
            boxShadow:
              "0 0 0 1px color-mix(in oklch, var(--button-dark) 55%, transparent), 0 24px 48px oklch(0 0 0 / 0.45)",
          }}
        >
          <form action={action} className="flex flex-col gap-4">
            {/* Error Message */}
            {state?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground mb-1 leading-relaxed">
              Niribi is a private community. Sign in with your Google account below to request access.
            </p>

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full border border-border bg-[var(--button-light)] text-[var(--button-dark)] hover:bg-[color-mix(in_oklch,var(--button-light)_92%,var(--brand)_8%)] active:bg-[color-mix(in_oklch,var(--button-light)_86%,var(--brand)_14%)] font-semibold shadow-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-3 dark:bg-[var(--button-light)] dark:text-[var(--button-dark)] dark:hover:bg-[color-mix(in_oklch,var(--button-light)_92%,var(--brand)_8%)]"
            >
              {/* Google G Vector Icon */}
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              {isPending ? "Connecting to Google…" : "Sign in with Google"}
            </Button>
          </form>
        </div>

        <div className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/60 max-w-xs mx-auto">
          By signing in, you agree to request membership. New accounts start as pending and must be approved by the administrator before you can join rooms or chat.
        </div>
      </div>
    </main>
  );
}
