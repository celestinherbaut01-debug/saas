import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/** Client Supabase pour les Client Components (navigateur). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
