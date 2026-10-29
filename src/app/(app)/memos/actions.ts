"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { requireProfile } from "@/lib/auth";
import { describeDbError } from "@/lib/errors";
import { canDeleteMemo } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { parseMemoFormData, parseUuid, type MemoItemInput } from "@/lib/validation";
import type { Json } from "@/types/database";

function itemsPayload(items: MemoItemInput[]): Json {
  return items.map((item) => ({
    item_name: item.itemName,
    partner_id: item.partnerId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));
}

function revalidateSalesSurfaces(memoId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/memos");
  revalidatePath("/reports");

  if (memoId) {
    revalidatePath(`/memos/${memoId}`);
  }
}

function formUuid(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? parseUuid(value) : null;
}

export async function createMemoAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();

  const parsed = parseMemoFormData(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const supabase = await createClient();
  const { data: memoId, error } = await supabase.rpc("create_sales_memo", {
    p_sale_date: parsed.data.saleDate,
    p_customer_name: parsed.data.customerName,
    p_customer_phone: parsed.data.customerPhone,
    p_items: itemsPayload(parsed.data.items),
  });

  if (error || !memoId) {
    return {
      status: "error",
      message: describeDbError(error, "Could not save the sale. Please try again."),
    };
  }

  const { data: savedMemo } = await supabase
    .from("sales_memos")
    .select("grand_total")
    .eq("id", memoId)
    .maybeSingle();

  revalidateSalesSurfaces(memoId);

  return {
    status: "success",
    message: "Sale saved.",
    savedMemoId: memoId,
    savedTotal: savedMemo ? Number(savedMemo.grand_total) : undefined,
    savedItemCount: parsed.data.items.length,
    savedQuantity: parsed.data.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export async function updateMemoAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();

  const memoId = formUuid(formData, "memoId");
  if (!memoId) {
    return { status: "error", message: "That sale could not be identified." };
  }

  const parsed = parseMemoFormData(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_sales_memo", {
    p_memo_id: memoId,
    p_sale_date: parsed.data.saleDate,
    p_customer_name: parsed.data.customerName,
    p_customer_phone: parsed.data.customerPhone,
    p_items: itemsPayload(parsed.data.items),
  });

  if (error) {
    return {
      status: "error",
      message: describeDbError(error, "Could not update the sale. Please try again."),
    };
  }

  revalidateSalesSurfaces(memoId);
  redirect(`/memos/${memoId}?notice=updated`);
}

export async function deleteMemoAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();

  if (!canDeleteMemo(profile.role)) {
    return { status: "error", message: "Only an owner can delete a sale." };
  }

  const memoId = formUuid(formData, "memoId");
  if (!memoId) {
    return { status: "error", message: "That sale could not be identified." };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("sales_memos")
    .delete({ count: "exact" })
    .eq("id", memoId);

  if (error) {
    return {
      status: "error",
      message: describeDbError(error, "Could not delete the sale. Please try again."),
    };
  }

  if (!count) {
    return { status: "error", message: "That sale no longer exists." };
  }

  revalidateSalesSurfaces();
  redirect("/memos?notice=deleted");
}
