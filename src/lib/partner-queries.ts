import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/types/database";

export type PartnerOption = Pick<Partner, "id" | "name" | "is_active">;

export async function listPartnerOptions(): Promise<{
  partners: PartnerOption[];
  failed: boolean;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("id, name, is_active")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) return { partners: [], failed: true };

  return { partners: data, failed: false };
}

export async function listPartners(): Promise<{ partners: Partner[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) return { partners: [], failed: true };

  return { partners: data, failed: false };
}
