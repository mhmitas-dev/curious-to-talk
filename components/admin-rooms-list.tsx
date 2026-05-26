"use client";

import { useActionState, useState, useEffect } from "react";
import { renameRoom, deleteRoom } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Room {
  id: string;
  name: string;
  description: string | null;
}

interface AdminRoomsListProps {
  rooms: Room[];
}

export function AdminRoomsList({ rooms }: AdminRoomsListProps) {
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [renameState, renameSubmitAction, isRenamePending] = useActionState(
    renameRoom,
    undefined
  );
  const [deleteState, deleteSubmitAction, isDeletePending] = useActionState(
    deleteRoom,
    undefined
  );

  // Clear editing/deleting states on success
  useEffect(() => {
    if (!isRenamePending && !renameState?.error) {
      const timer = setTimeout(() => setEditingRoomId(null), 0);
      return () => clearTimeout(timer);
    }
  }, [isRenamePending, renameState]);

  useEffect(() => {
    if (!isDeletePending && !deleteState?.error) {
      const timer = setTimeout(() => setDeletingRoomId(null), 0);
      return () => clearTimeout(timer);
    }
  }, [isDeletePending, deleteState]);

  return (
    <div className="space-y-4">
      {rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--brand) 18%, transparent), color-mix(in oklch, var(--brand-deep) 14%, transparent))",
              border: "1px solid color-mix(in oklch, var(--brand) 25%, transparent)",
            }}
          >
            🔇
          </div>
          <p className="font-medium text-foreground">No rooms active</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Create a room on the home page dashboard to manage it here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => {
            const isEditing = editingRoomId === room.id;
            const isDeleting = deletingRoomId === room.id;

            return (
              <li
                key={room.id}
                className={`rounded-2xl border border-border p-4 transition-all duration-200 ${
                  isEditing
                    ? "bg-card border-primary/50 shadow-lg shadow-primary/5"
                    : "bg-card/50 hover:bg-card hover:border-primary/20"
                }`}
              >
                {/* ── EDIT MODE ────────────────────────────────────────── */}
                {isEditing ? (
                  <form action={renameSubmitAction} className="flex flex-col gap-3">
                    <input type="hidden" name="roomId" value={room.id} />

                    <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Rename Room
                      </p>
                      {renameState?.error && (
                        <span className="text-xs text-destructive font-medium">
                          {renameState.error}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`edit-name-${room.id}`} className="text-xs font-semibold text-muted-foreground">
                        Room Name
                      </Label>
                      <Input
                        id={`edit-name-${room.id}`}
                        name="name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                        placeholder="e.g. Chill lounge"
                        className="h-9 text-sm bg-background/50 focus:bg-background"
                        autoFocus
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`edit-desc-${room.id}`} className="text-xs font-semibold text-muted-foreground">
                        Description (optional)
                      </Label>
                      <Input
                        id={`edit-desc-${room.id}`}
                        name="description"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="e.g. Chat, stream, listen together"
                        className="h-9 text-sm bg-background/50 focus:bg-background"
                      />
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border/50 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 rounded-lg text-xs"
                        onClick={() => {
                          setEditingRoomId(null);
                          setEditName("");
                          setEditDesc("");
                        }}
                        disabled={isRenamePending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isRenamePending}
                        className="flex-1 h-8 rounded-lg text-xs font-semibold text-primary-foreground"
                        style={{
                          background: isRenamePending
                            ? undefined
                            : "linear-gradient(135deg, var(--brand-bright), var(--brand-deep))",
                        }}
                      >
                        {isRenamePending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </form>
                ) : isDeleting ? (
                  /* ── DELETE CONFIRMATION ────────────────────────────── */
                  <form action={deleteSubmitAction} className="flex flex-col gap-3">
                    <input type="hidden" name="roomId" value={room.id} />
                    
                    <div className="flex flex-col gap-1.5 py-1 text-center sm:text-left">
                      <p className="text-sm font-semibold text-foreground">
                        Delete Room &quot;{room.name}&quot;?
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This action cannot be undone. Active voice connections will disconnect and the room link will expire.
                      </p>
                      {deleteState?.error && (
                        <p className="text-xs text-destructive font-medium mt-1">
                          {deleteState.error}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 rounded-lg text-xs"
                        onClick={() => setDeletingRoomId(null)}
                        disabled={isDeletePending}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="destructive"
                        size="sm"
                        className="flex-1 h-8 rounded-lg text-xs font-semibold"
                        disabled={isDeletePending}
                      >
                        {isDeletePending ? "Deleting…" : "Confirm Delete"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* ── NORMAL CARD VIEW ──────────────────────────────── */
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl select-none"
                      style={{
                        background:
                          "linear-gradient(135deg, color-mix(in oklch, var(--brand) 18%, transparent), color-mix(in oklch, var(--brand-deep) 14%, transparent))",
                        border: "1px solid color-mix(in oklch, var(--brand) 25%, transparent)",
                      }}
                    >
                      🔊
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate text-sm">
                        {room.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {room.description || "No description provided"}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg"
                        onClick={() => {
                          setEditingRoomId(room.id);
                          setEditName(room.name);
                          setEditDesc(room.description || "");
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-7 text-xs px-2 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors rounded-lg"
                        onClick={() => {
                          setDeletingRoomId(room.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
