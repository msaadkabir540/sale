import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatMoney } from "@/lib/money";

export function SavedSaleDialog({
  open,
  total,
  memoId,
  itemCount,
  quantity,
  onAnother,
}: {
  open: boolean;
  total?: number;
  memoId?: string;
  itemCount?: number;
  quantity?: number;
  onAnother: () => void;
}) {
  return (
    <Modal
      open={open}
      labelledBy="sale-saved-title"
      className="w-full max-w-sm p-6 text-center"
    >
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
        <CheckIcon className="size-6" />
      </div>
      <h2
        id="sale-saved-title"
        className="mt-4 text-lg font-semibold tracking-tight text-slate-900"
      >
        Sale saved
      </h2>
      <p className="mt-1 text-sm text-slate-500">The sale has been recorded.</p>

      {total !== undefined ? (
        <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
          {formatMoney(total)}
        </p>
      ) : null}
      {itemCount !== undefined && quantity !== undefined ? (
        <p className="mt-2 text-xs text-slate-500">
          {itemCount} {itemCount === 1 ? "line item" : "line items"} ·{" "}
          {quantity} total qty
        </p>
      ) : null}
      {memoId ? (
        <p className="mt-1 text-xs text-slate-400">
          Sale {memoId.slice(0, 8).toUpperCase()}
        </p>
      ) : null}

      <Button className="mt-5 w-full" onClick={onAnother}>
        Record another sale
      </Button>
    </Modal>
  );
}
