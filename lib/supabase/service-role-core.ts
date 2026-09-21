import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRequiredServerSecret } from "../config/server-env.ts";

function getRequiredSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing required server environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  return url;
}

/**
 * Creates a privileged client exclusively for trusted server jobs.
 *
 * This module deliberately does not cache the client: command invocations and
 * server requests must not share an authentication state.
 */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    getRequiredSupabaseUrl(),
    getRequiredServerSecret("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
