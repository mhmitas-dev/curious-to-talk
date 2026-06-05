import type { RoomAppMeta } from "./room-app-types";

export function PreviewApp({ app }: { app: RoomAppMeta }) {
  const Icon = app.Icon;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 pb-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-foreground shadow-sm">
        <Icon className="h-8 w-8" />
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">
        {app.label} is coming later.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {app.description}
      </p>
    </div>
  );
}
