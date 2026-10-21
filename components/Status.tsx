export function LiveDot({ live }: { live: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-green-500" : "bg-zinc-400"}`} />
      {live ? "Live" : "Connecting…"}
    </span>
  );
}

export function Loading() {
  return <p className="py-16 text-center text-zinc-500">Loading…</p>;
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-semibold">Couldn&apos;t reach the database</p>
      <p className="mt-1">{message}</p>
      <p className="mt-2">Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and that supabase/schema.sql has been run.</p>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
      {children}
    </p>
  );
}
