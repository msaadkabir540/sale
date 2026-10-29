import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types/database";

const ROLE_CLASSES: Record<UserRole, string> = {
  owner: "badge badge-owner",
  admin: "badge badge-admin",
  salesman: "badge badge-salesman",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <span className={ROLE_CLASSES[role]}>{ROLE_LABELS[role]}</span>;
}

export function PartnerStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={active ? "badge badge-active" : "badge badge-inactive"}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}
