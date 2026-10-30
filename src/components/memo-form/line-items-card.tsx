import { PlusIcon, XIcon } from "@/components/icons";
import type {
  ItemState,
  MemoFormItem,
  MemoFormPartner,
} from "@/components/memo-form/types";
import { rowHasContent } from "@/components/memo-form/types";
import { Button } from "@/components/ui/button";
import { FieldErrors, Label } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";

export function LineItemsCard({
  items,
  partners,
  lineTotals,
  itemCount,
  totalQuantity,
  grandTotal,
  errors,
  onAdd,
  onRemove,
  onUpdate,
}: {
  items: ItemState[];
  partners: MemoFormPartner[];
  lineTotals: number[];
  itemCount: number;
  totalQuantity: number;
  grandTotal: number;
  errors?: string[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onUpdate: (key: string, patch: Partial<MemoFormItem>) => void;
}) {
  return (
    <section className="card flex min-h-0 flex-col overflow-hidden lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">
            Line items
          </h2>
          <p className="text-xs text-slate-500">
            Description, optional partner, quantity, and rate.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onAdd}
          className="whitespace-nowrap"
        >
          <PlusIcon className="size-4" />
          Add row
        </Button>
      </div>

      <div className="hidden shrink-0 border-b border-slate-200 bg-surface-50 px-6 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:grid sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5rem_7rem_7rem_2.5rem] sm:items-center sm:gap-3">
        <span>No.</span>
        <span>Description</span>
        <span>Partner</span>
        <span>Qty</span>
        <span>Rate</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <div className="max-h-[45vh] min-h-0 divide-y divide-slate-100 overflow-y-auto lg:max-h-none lg:flex-1">
        {items.map((item, index) => {
          const hasContent = rowHasContent(item);
          const partnerOptions = partners.filter(
            (partner) => partner.is_active || partner.id === item.partnerId,
          );

          return (
            <div
              key={item.key}
              className="grid gap-3 px-5 py-3.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_9rem_5rem_7rem_7rem_2.5rem] sm:items-start sm:gap-3 sm:px-6"
            >
              <div className="hidden pt-3 text-xs font-medium tabular-nums text-slate-400 sm:block">
                {String(index + 1).padStart(2, "0")}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between sm:hidden">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Item {index + 1}
                  </p>
                  <IconButton
                    label={`Remove item ${index + 1}`}
                    tone="danger"
                    onClick={() => onRemove(item.key)}
                    disabled={items.length === 1}
                  >
                    <XIcon className="size-4" />
                  </IconButton>
                </div>

                <Label className="sm:sr-only" htmlFor={`item-name-${item.key}`}>
                  Description
                </Label>
                <Input
                  id={`item-name-${item.key}`}
                  value={item.itemName}
                  onChange={(event) =>
                    onUpdate(item.key, { itemName: event.target.value })
                  }
                  maxLength={120}
                  placeholder="Jacket, Shirt, Shoes…"
                  autoComplete="off"
                  required={hasContent}
                />
              </div>

              <div>
                <Label className="sm:sr-only" htmlFor={`item-partner-${item.key}`}>
                  Partner
                </Label>
                <Select
                  id={`item-partner-${item.key}`}
                  value={item.partnerId}
                  onChange={(event) =>
                    onUpdate(item.key, { partnerId: event.target.value })
                  }
                >
                  <option value="">No partner</option>
                  {partnerOptions.map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                      {partner.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:contents">
                <div>
                  <Label className="sm:sr-only" htmlFor={`item-qty-${item.key}`}>
                    Qty
                  </Label>
                  <Input
                    id={`item-qty-${item.key}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100000}
                    step={1}
                    value={item.quantity}
                    onChange={(event) =>
                      onUpdate(item.key, { quantity: event.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label className="sm:sr-only" htmlFor={`item-price-${item.key}`}>
                    Rate
                  </Label>
                  <Input
                    id={`item-price-${item.key}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={1000000}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      onUpdate(item.key, { unitPrice: event.target.value })
                    }
                    placeholder="0.00"
                    required={hasContent}
                  />
                </div>
              </div>

              <div>
                <span className="label sm:sr-only">Amount</span>
                <div className="flex min-h-10 items-center justify-end rounded-lg bg-surface-50 px-3 text-sm font-semibold tabular-nums text-slate-900 sm:bg-transparent sm:px-0">
                  {formatMoney(lineTotals[index] ?? 0)}
                </div>
              </div>

              <div className="hidden sm:flex sm:justify-end sm:pt-2.5">
                <IconButton
                  label={`Remove item ${index + 1}`}
                  tone="danger"
                  onClick={() => onRemove(item.key)}
                  disabled={items.length === 1}
                >
                  <XIcon className="size-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
      </div>

      {errors?.length ? (
        <div className="shrink-0 px-5 py-3 sm:px-6">
          <FieldErrors messages={errors} />
        </div>
      ) : null}

      <div className="mt-auto flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-surface-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-slate-500">
          Recalculated on the server when you save. Quantities start at 1.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Items
            </p>
            <p className="text-sm font-semibold tabular-nums text-slate-800">
              {itemCount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Total qty
            </p>
            <p className="text-sm font-semibold tabular-nums text-slate-800">
              {totalQuantity}
            </p>
          </div>
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <span className="text-sm font-medium text-slate-600">Grand total</span>
            <span
              className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900"
              aria-live="polite"
            >
              {formatMoney(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
