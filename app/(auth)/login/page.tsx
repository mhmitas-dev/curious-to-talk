"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, isPending] = useActionState(login, undefined);

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.35 0.18 285 / 0.18) 0%, transparent 70%)",
        }}
      />

      <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.55 0.22 285), oklch(0.45 0.20 300))",
              boxShadow: "0 0 32px oklch(0.55 0.22 285 / 0.4)",
            }}
          >
            🎙️
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Curious to Talk
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
              "0 0 0 1px oklch(0.22 0.01 265), 0 24px 48px oklch(0 0 0 / 0.5)",
          }}
        >
          <form action={action} className="flex flex-col gap-5">
            {/* Error */}
            {state?.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-11 w-full font-semibold"
              style={{
                background: isPending
                  ? undefined
                  : "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
              }}
            >
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline underline-offset-4"
          >
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
