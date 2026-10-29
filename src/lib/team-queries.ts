import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function listProfiles(): Promise<{ profiles: Profile[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, updated_at")
    .order("full_name", { ascending: true });

  if (error) return { profiles: [], failed: true };

  return { profiles: data, failed: false };
}
