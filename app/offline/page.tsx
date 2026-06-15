export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-xl font-semibold text-primary">
          N
        </div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Niribi needs a connection for voice rooms, messages, and shared media.
          Reconnect, then try again.
        </p>
        <form action="/" method="get" className="mt-6">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>
        </form>
      </section>
    </main>
  );
}
