import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/alert";
import { MemoForm } from "@/components/memo-form";
import { requireProfile } from "@/lib/auth";
import { getMemoDetail } from "@/lib/memo-queries";
import { listPartnerOptions } from "@/lib/partner-queries";
import { canEditMemo } from "@/lib/permissions";
import { parseUuid } from "@/lib/validation";

import { updateMemoAction } from "../../actions";

export const metadata: Metadata = { title: "Edit sale" };

type EditMemoPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMemoPage({ params }: EditMemoPageProps) {
  const { id } = await params;
  const memoId = parseUuid(id);
  if (!memoId) notFound();

  const profile = await requireProfile();
  if (profile.role === "salesman") redirect("/memos/new");

  const detail = await getMemoDetail(memoId);
  if (!detail) notFound();

  if (!canEditMemo(profile.role, detail.memo.created_by, profile.id)) {
    redirect(`/memos/${memoId}?notice=readonly`);
  }

  const { partners, failed } = await listPartnerOptions();

  return (
    <div className="space-y-4">
      {failed ? (
        <Alert variant="error" title="Partners could not be loaded">
          Refresh the page to try again.
        </Alert>
      ) : (
        <MemoForm
          action={updateMemoAction}
          partners={partners}
          memoId={memoId}
          title="Edit sale"
          showExpense
          initial={{
            saleDate: detail.memo.sale_date,
            customerName: detail.memo.customer_name ?? "",
            customerPhone: detail.memo.customer_phone ?? "",
            items: detail.items.map((item) => ({
              partnerId: item.partner_id ?? "",
              itemName: item.item_name,
              quantity: String(item.quantity),
              unitPrice: Number(item.unit_price).toFixed(2),
            })),
          }}
          submitLabel="Save changes"
          cancelHref={`/memos/${memoId}`}
        />
      )}
    </div>
  );
}
