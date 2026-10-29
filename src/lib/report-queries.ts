import "server-only";

import type { DateRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type {
  SalesByDayRow,
  SalesByPartnerRow,
  SalesSummaryRow,
} from "@/types/database";

export type SalesReport = {
  summary: SalesSummaryRow;
  partners: SalesByPartnerRow[];
  days: SalesByDayRow[];
};

const EMPTY_SUMMARY: SalesSummaryRow = {
  grand_total: 0,
  memo_count: 0,
  item_count: 0,
};

export async function getSalesSummary(
  range: DateRange,
  partnerId: string | null = null,
): Promise<SalesSummaryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sales_summary", {
    p_from: range.from,
    p_to: range.to,
    p_partner_id: partnerId,
  });

  if (error) return null;

  return data?.[0] ?? EMPTY_SUMMARY;
}

export async function getSalesReport(
  range: DateRange,
  partnerId: string | null = null,
): Promise<SalesReport | null> {
  const supabase = await createClient();

  const [summaryResult, partnerResult, dayResult] = await Promise.all([
    supabase.rpc("sales_summary", {
      p_from: range.from,
      p_to: range.to,
      p_partner_id: partnerId,
    }),
    supabase.rpc("sales_by_partner", {
      p_from: range.from,
      p_to: range.to,
      p_partner_id: partnerId,
    }),
    supabase.rpc("sales_by_day", {
      p_from: range.from,
      p_to: range.to,
      p_partner_id: partnerId,
    }),
  ]);

  if (summaryResult.error || partnerResult.error || dayResult.error) return null;

  return {
    summary: summaryResult.data?.[0] ?? EMPTY_SUMMARY,
    partners: partnerResult.data ?? [],
    days: dayResult.data ?? [],
  };
}
