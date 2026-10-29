"use server";

import { revalidatePath } from "next/cache";

import type { ExpenseActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/auth";
import { describeDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { expenseInputSchema } from "@/lib/validation";

export async function createExpenseAction(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const profile = await requireProfile();

  const parsed = expenseInputSchema.safeParse({
    name: formData.get("name") ?? undefined,
    price: formData.get("price") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of parsed.error.issues) {
      const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
      (fieldErrors[key] ??= []).push(issue.message);
    }

    return {
      status: "error",
      message: "Check the expense details and try again.",
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    name: parsed.data.name,
    amount: parsed.data.price,
    created_by: profile.id,
    created_by_name: profile.full_name,
    created_by_role: profile.role,
  });

  if (error) {
    return {
      status: "error",
      message: describeDbError(error, "Could not save the expense. Please try again."),
    };
  }

  revalidatePath("/expenses");

  return { status: "success", message: "Expense recorded." };
}
