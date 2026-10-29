import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SalesMemo, SalesMemoItem, SalesMemoListRow } from "@/types/database";

export const MEMO_PAGE_SIZE = 20;

export type ListSalesMemosParams = {
  from?: string | null;
  to?: string | null;
  query?: string | null;
  partnerId?: string | null;
  page?: number;
  pageSize?: number;
};

export type SalesMemoListResult = {
  rows: SalesMemoListRow[];
  total: number;
  page: number;
  pageCount: number;
  failed: boolean;
};

export async function listSalesMemos(
  params: ListSalesMemosParams = {},
): Promise<SalesMemoListResult> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(params.pageSize ?? MEMO_PAGE_SIZE, 1), 100);
  const page = Math.max(params.page ?? 1, 1);

  const { data, error } = await supabase.rpc("list_sales_memos", {
    p_from: params.from ?? null,
    p_to: params.to ?? null,
    p_query: params.query ?? null,
    p_partner_id: params.partnerId ?? null,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });

  if (error || !data) {
    return { rows: [], total: 0, page, pageCount: 1, failed: Boolean(error) };
  }

  const rows = data as SalesMemoListRow[];
  const total = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0;

  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    failed: false,
  };
}

export type MemoDetailItem = SalesMemoItem & {
  partner_name: string | null;
};

export type MemoDetail = {
  memo: SalesMemo;
  items: MemoDetailItem[];
};

export async function getMemoDetail(memoId: string): Promise<MemoDetail | null> {
  const supabase = await createClient();

  const { data: memo, error } = await supabase
    .from("sales_memos")
    .select("*")
    .eq("id", memoId)
    .maybeSingle();

  if (error || !memo) return null;

  const { data: items, error: itemsError } = await supabase
    .from("sales_memo_items")
    .select("*")
    .eq("memo_id", memoId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (itemsError || !items) return null;

  const partnerIds = Array.from(
    new Set(
      items
        .map((item) => item.partner_id)
        .filter((partnerId): partnerId is string => Boolean(partnerId)),
    ),
  );

  let partnerNames = new Map<string, string>();

  if (partnerIds.length > 0) {
    const { data: partners, error: partnersError } = await supabase
      .from("partners")
      .select("id, name")
      .in("id", partnerIds);

    if (partnersError) return null;

    partnerNames = new Map((partners ?? []).map((partner) => [partner.id, partner.name]));
  }

  return {
    memo,
    items: items.map((item) => ({
      ...item,
      partner_name: item.partner_id ? (partnerNames.get(item.partner_id) ?? null) : null,
    })),
  };
}
