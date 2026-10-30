"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { createExpenseAction } from "@/app/(app)/expenses/actions";
import { Alert } from "@/components/alert";
import { PlusIcon, WalletIcon, XIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { IDLE_EXPENSE_ACTION_STATE } from "@/lib/action-state";

type ExpenseDialogProps = {
  label?: string;
  variant?: "toolbar" | "primary";
  refreshOnSuccess?: boolean;
};

function ExpenseModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [state, formAction] = useActionState(
    createExpenseAction,
    IDLE_EXPENSE_ACTION_STATE,
  );
  const handledSuccess = useRef(false);

  useEffect(() => {
    if (state.status === "success" && !handledSuccess.current) {
      handledSuccess.current = true;
      onSuccess(state.message ?? "Expense recorded.");
    }
  }, [state, onSuccess]);

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="expense-dialog-title"
      align="top"
      className="w-full max-w-md p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
            Expense
          </p>
          <h2
            id="expense-dialog-title"
            className="mt-1 text-lg font-semibold tracking-tight text-slate-900"
          >
            Add expense
          </h2>
        </div>
        <IconButton label="Close expense dialog" onClick={onClose}>
          <XIcon className="size-4" />
        </IconButton>
      </div>

      {state.status === "error" && state.message ? (
        <Alert variant="error" className="mt-4">
          {state.message}
        </Alert>
      ) : null}

      <form action={formAction} className="mt-4 space-y-4">
        <Field
          label="Expense name"
          htmlFor="expense-name"
          errors={fieldErrors.name}
        >
          <Input
            id="expense-name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={120}
            placeholder="Shopping bag"
            autoComplete="off"
            autoFocus
            required
            aria-invalid={Boolean(fieldErrors.name)}
          />
        </Field>

        <Field
          label="Price"
          htmlFor="expense-price"
          hint="Dated today. Amounts are in Pakistani Rupees."
          errors={fieldErrors.price}
        >
          <Input
            id="expense-price"
            name="price"
            type="number"
            inputMode="decimal"
            min={0}
            max={100000000}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            required
            aria-invalid={Boolean(fieldErrors.price)}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
            Save expense
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function ExpenseDialog({
  label = "Expense",
  variant = "toolbar",
  refreshOnSuccess = false,
}: ExpenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleSuccess = (message: string) => {
    setOpen(false);
    setNotice(message);

    if (refreshOnSuccess) {
      router.refresh();
    }
  };

  return (
    <>
      <Button
        variant={variant === "primary" ? "primary" : "ghost"}
        size={variant === "primary" ? "md" : "sm"}
        className="whitespace-nowrap"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
      >
        {variant === "primary" ? (
          <PlusIcon className="size-4" />
        ) : (
          <WalletIcon className="size-4" />
        )}
        {label}
      </Button>

      {notice ? (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm" role="status">
          <Alert variant="success" className="shadow-lg">
            {notice}
          </Alert>
        </div>
      ) : null}

      {open ? (
        <ExpenseModal onClose={() => setOpen(false)} onSuccess={handleSuccess} />
      ) : null}
    </>
  );
}
