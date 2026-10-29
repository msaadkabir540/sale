import type { Metadata } from "next";

import { Alert } from "@/components/alert";
import { RoleBadge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeadCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";
import { listProfiles } from "@/lib/team-queries";
import type { UserRole } from "@/types/database";

import { changeRoleAction } from "./actions";

export const metadata: Metadata = { title: "Team" };

type TeamPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, string> = {
  "role-updated": "Role updated. The change applies on the member's next request.",
};

const ROLE_ORDER: UserRole[] = ["owner", "admin", "salesman"];

function first(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ?? null;
}

export default async function TeamPage({ searchParams }: TeamPageProps) {
  const profile = await requireOwner();
  const params = await searchParams;
  const { profiles, failed } = await listProfiles();

  const noticeKey = first(params.notice);
  const notice = noticeKey ? NOTICES[noticeKey] : null;
  const error = first(params.error);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner tools"
        title="Team access"
        description="Roles decide what each member can see and change. Authorization is enforced in the database, not only in this screen."
      />

      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {ROLE_ORDER.map((role) => (
          <div key={role} className="card p-4">
            <RoleBadge role={role} />
            <p className="mt-2 text-xs leading-5 text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <section className="card" aria-label="Team members">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight text-slate-900">Members</h2>
          <p className="mt-1 text-sm text-slate-500">
            {profiles.length} {profiles.length === 1 ? "account" : "accounts"} · the workspace must
            keep at least one owner.
          </p>
        </div>

        {failed ? (
          <div className="p-5">
            <Alert variant="error">Team members could not be loaded. Refresh to try again.</Alert>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHeadCell>Member</TableHeadCell>
                <TableHeadCell>Current role</TableHeadCell>
                <TableHeadCell>Joined</TableHeadCell>
                <TableHeadCell align="right">Change role</TableHeadCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <p className="font-medium text-slate-900">
                      {member.full_name}
                      {member.id === profile.id ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">You</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {member.id.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">
                    {formatDate(member.created_at.slice(0, 10))}
                  </TableCell>
                  <TableCell>
                    {member.id === profile.id ? (
                      <p className="text-right text-xs text-slate-400">
                        Ask another owner to change your role
                      </p>
                    ) : (
                      <form
                        action={changeRoleAction}
                        className="flex items-center justify-end gap-2"
                      >
                        <Input type="hidden" name="userId" value={member.id} />
                        <Label className="sr-only" htmlFor={`role-${member.id}`}>
                          Role for {member.full_name}
                        </Label>
                        <Select
                          id={`role-${member.id}`}
                          name="role"
                          defaultValue={member.role}
                          className="input-sm w-auto"
                        >
                          {ROLE_ORDER.map((role) => (
                            <option key={role} value={role}>
                              {role === "owner" ? "Owner" : role === "admin" ? "Admin" : "Salesman"}
                            </option>
                          ))}
                        </Select>
                        <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Saving…">
                          Save
                        </SubmitButton>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Alert variant="info">
        Salesmen see only their own sales and report totals. Admins see the company&apos;s sales but
        cannot manage partners or roles. Only owners can delete sales.
      </Alert>
    </div>
  );
}
