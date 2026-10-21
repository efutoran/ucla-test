import { createClient } from "@supabase/supabase-js";

// The Vercel <-> Supabase integration sets these automatically; newer projects
// get a "publishable" key instead of the legacy anon key, so accept either.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "missing-anon-key",
  { realtime: { params: { eventsPerSecond: 20 } } },
);
