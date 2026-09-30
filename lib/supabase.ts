import { createClient } from "@supabase/supabase-js";

// Server-only: uses the secret key, never import from a client component.
export const supabase = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const BUCKET = "media";
