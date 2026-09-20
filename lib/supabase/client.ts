import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// One client per call site is fine — @supabase/ssr's browser client is a
// singleton under the hood (isSingleton defaults to true).
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
