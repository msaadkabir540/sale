export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  savedMemoId?: string;
  savedTotal?: number;
  savedItemCount?: number;
  savedQuantity?: number;
};

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };

export type AuthState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const IDLE_AUTH_STATE: AuthState = { status: "idle" };

export type ExpenseActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const IDLE_EXPENSE_ACTION_STATE: ExpenseActionState = { status: "idle" };
