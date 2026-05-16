"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import { createRoom } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateRoomForm() {
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState(createRoom, undefined);
  const wasSubmittingRef = useRef(false);

  // Track when a submission starts
  useEffect(() => {
    if (isPending) {
      wasSubmittingRef.current = true;
    }
  }, [isPending]);

  // Close on success: pending → false, no error, and a submission happened
  useEffect(() => {
    if (!isPending && wasSubmittingRef.current && !state?.error) {
      setOpen(false);
      wasSubmittingRef.current = false;
    }
  }, [isPending, state]);

  return (
    <div className="mb-5">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-transparent py-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <span className="text-base leading-none">+</span>
          New room
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-4 text-sm font-medium text-foreground">
            Create a new room
          </p>

          <form action={action} className="flex flex-col gap-3">
            {state?.error && (
              <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                {state.error}
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-name" className="text-xs font-medium">
                Room name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="room-name"
                name="name"
                placeholder="e.g. Late night hangout"
                required
                className="h-10 text-sm"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-desc" className="text-xs font-medium">
                Description{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="room-desc"
                name="description"
                placeholder="What's this room for?"
                className="h-10 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="flex-1 h-9 text-xs font-semibold"
                style={{
                  background: isPending
                    ? undefined
                    : "linear-gradient(135deg, oklch(0.60 0.22 285), oklch(0.50 0.22 300))",
                }}
              >
                {isPending ? "Creating…" : "Create room"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
