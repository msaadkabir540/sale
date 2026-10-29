import type { UserRole } from "@/types/database";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  salesman: "Salesman",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  owner: "Full access to sales, partners, reports, and the team.",
  admin: "Records sales and views company-wide sales and reports.",
  salesman: "Records sales and sees only their own sales and totals.",
};

export function canManagePartners(role: UserRole): boolean {
  return role === "owner";
}

export function canManageTeam(role: UserRole): boolean {
  return role === "owner";
}

export function canViewAllSales(role: UserRole): boolean {
  return role === "owner" || role === "admin";
}

export function canDeleteMemo(role: UserRole): boolean {
  return role === "owner";
}

export function canEditMemo(role: UserRole, creatorId: string, userId: string): boolean {
  return role === "owner" || creatorId === userId;
}

export function salesScopeLabel(role: UserRole): string {
  return canViewAllSales(role) ? "All sales" : "Your sales";
}
