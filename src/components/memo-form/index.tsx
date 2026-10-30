"use client";

import { useActionState, useRef, useState } from "react";

import { Alert } from "@/components/alert";
import { LineItemsCard } from "@/components/memo-form/line-items-card";
import { MemoDetails } from "@/components/memo-form/memo-details";
import { MemoFormTopBar } from "@/components/memo-form/top-bar";
import { SavedSaleDialog } from "@/components/memo-form/saved-sale-dialog";
import {
  buildInitialItems,
  rowHasContent,
  SALE_SIGNOUT_FORM_ID,
  type ItemState,
  type MemoFormItem,
  type MemoFormProps,
} from "@/components/memo-form/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import {
  calculateGrandTotal,
  calculateLineTotal,
} from "@/lib/money";

export function MemoForm({
  action,
  partners,
  initial,
  title,
  submitLabel,
  cancelHref,
  memoId,
  showNavigation = true,
  showSignOut = false,
  showExpense = false,
}: MemoFormProps) {
  const [state, formAction] = useActionState(action, IDLE_ACTION_STATE);

  const initialItems = buildInitialItems(initial);
  const [items, setItems] = useState<ItemState[]>(initialItems);
  const [saleDate, setSaleDate] = useState(initial.saleDate);
  const [customerName, setCustomerName] = useState(initial.customerName);
  const [customerPhone, setCustomerPhone] = useState(initial.customerPhone);
  const nextKey = useRef(initialItems.length);

  const fieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  function updateItem(key: string, patch: Partial<MemoFormItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    const key = `item-${nextKey.current}`;
    nextKey.current += 1;
    setItems((current) => [
      ...current,
      { key, partnerId: "", itemName: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function removeItem(key: string) {
    setItems((current) =>
      current.length > 1 ? current.filter((item) => item.key !== key) : current,
    );
  }

  const lineTotals = items.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    return Number.isFinite(quantity) && Number.isFinite(unitPrice)
      ? calculateLineTotal(quantity, unitPrice)
      : 0;
  });

  const activeItems = items.filter(rowHasContent);
  const itemCount = activeItems.length;
  const totalQuantity = activeItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0,
  );
  const grandTotal = calculateGrandTotal(
    activeItems.map((item) => ({
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
    })),
  );

  const serializedItems = JSON.stringify(
    activeItems.map(({ partnerId, itemName, quantity, unitPrice }) => ({
      partnerId,
      itemName,
      quantity,
      unitPrice,
    })),
  );

  return (
    <>
      <form
        action={formAction}
        className="flex flex-col gap-3 sm:gap-4 lg:h-[calc(100dvh-2.5rem)] lg:min-h-0 lg:overflow-hidden"
      >
        <Input type="hidden" name="items" value={serializedItems} />
        {memoId ? <Input type="hidden" name="memoId" value={memoId} /> : null}

        {state.status === "error" && state.message ? (
          <Alert variant="error" title="The sale was not saved" className="shrink-0">
            {state.message}
          </Alert>
        ) : null}

        <MemoFormTopBar
          title={title}
          memoId={memoId}
          cancelHref={cancelHref}
          showNavigation={showNavigation}
          showSignOut={showSignOut}
          showExpense={showExpense}
        />

        <MemoDetails
          saleDate={saleDate}
          onSaleDateChange={setSaleDate}
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          customerPhone={customerPhone}
          onCustomerPhoneChange={setCustomerPhone}
          errors={fieldErrors}
        />

        <LineItemsCard
          items={items}
          partners={partners}
          lineTotals={lineTotals}
          itemCount={itemCount}
          totalQuantity={totalQuantity}
          grandTotal={grandTotal}
          errors={fieldErrors.items}
          onAdd={addItem}
          onRemove={removeItem}
          onUpdate={updateItem}
        />

        <div className="sticky bottom-0 z-20 -mx-4 flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-surface-50/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {showNavigation ? (
            <ButtonLink href={cancelHref} variant="secondary">
              Cancel
            </ButtonLink>
          ) : null}
          <SubmitButton className="btn btn-primary sm:min-w-40" pendingLabel="Saving sale…">
            {submitLabel}
          </SubmitButton>
        </div>
      </form>

      {showSignOut ? (
        <form id={SALE_SIGNOUT_FORM_ID} action="/auth/signout" method="post" className="hidden" />
      ) : null}

      <SavedSaleDialog
        open={state.status === "success"}
        total={state.savedTotal}
        memoId={state.savedMemoId}
        itemCount={state.savedItemCount}
        quantity={state.savedQuantity}
        onAnother={() => window.location.reload()}
      />
    </>
  );
}

export type { MemoFormInitial, MemoFormPartner } from "@/components/memo-form/types";
