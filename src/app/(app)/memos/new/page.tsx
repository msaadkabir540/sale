import type { Metadata } from "next";

import { Alert } from "@/components/alert";
import { MemoForm } from "@/components/memo-form";
import { requireProfile } from "@/lib/auth";
import { todayIso } from "@/lib/dates";
import { listPartnerOptions } from "@/lib/partner-queries";

import { createMemoAction } from "../actions";

export const metadata: Metadata = { title: "New sale" };

export default async function NewMemoPage() {
  const profile = await requireProfile();

  const { partners, failed } = await listPartnerOptions();
  const isSalesman = profile.role === "salesman";

  return (
    <div className="space-y-4">
      {failed ? (
        <Alert variant="error" title="Partners could not be loaded">
          Refresh the page to try again. If the problem continues, check the Supabase connection.
        </Alert>
      ) : (
        <MemoForm
          action={createMemoAction}
          partners={partners}
          title="New sale"
          initial={{
            saleDate: todayIso(),
            customerName: "",
            customerPhone: "",
            items: [{ partnerId: "", itemName: "", quantity: "1", unitPrice: "" }],
          }}
          submitLabel="Save sale"
          cancelHref="/memos"
          showNavigation={!isSalesman}
          showSignOut={isSalesman}
          showExpense
        />
      )}
    </div>
  );
}
