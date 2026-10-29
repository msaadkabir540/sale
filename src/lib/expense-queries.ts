import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/types/database";

export async function listExpenses(
  from: string,
  to: string,
): Promise<{ expenses: Expense[]; failed: boolean }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return { expenses: [], failed: true };

  return { expenses: data, failed: false };
}
