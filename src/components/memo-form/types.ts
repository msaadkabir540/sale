import type { ActionState } from "@/lib/action-state";

export type MemoFormPartner = {
  id: string;
  name: string;
  is_active: boolean;
};

export type MemoFormItem = {
  partnerId: string;
  itemName: string;
  quantity: string;
  unitPrice: string;
};

export type MemoFormInitial = {
  saleDate: string;
  customerName: string;
  customerPhone: string;
  items: MemoFormItem[];
};

export type ItemState = MemoFormItem & { key: string };

export type MemoFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  partners: MemoFormPartner[];
  initial: MemoFormInitial;
  title: string;
  submitLabel: string;
  cancelHref: string;
  memoId?: string;
  showNavigation?: boolean;
  showSignOut?: boolean;
  showExpense?: boolean;
};

export const DEFAULT_ROW_COUNT = 8;
export const SALE_SIGNOUT_FORM_ID = "sale-signout-form";

export function rowHasContent(item: MemoFormItem): boolean {
  return (
    item.itemName.trim() !== "" ||
    item.unitPrice.trim() !== "" ||
    item.partnerId !== "" ||
    item.quantity.trim() !== "1"
  );
}

export function buildInitialItems(initial: MemoFormInitial): ItemState[] {
  return Array.from(
    { length: Math.max(DEFAULT_ROW_COUNT, initial.items.length) },
    (_, index) => {
      const seeded = initial.items[index];

      return {
        key: `initial-${index}`,
        partnerId: seeded?.partnerId ?? "",
        itemName: seeded?.itemName ?? "",
        quantity: seeded?.quantity ?? "1",
        unitPrice: seeded?.unitPrice ?? "",
      };
    },
  );
}
