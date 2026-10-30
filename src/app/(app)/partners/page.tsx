import type { Metadata } from "next";

import { Alert } from "@/components/alert";
import { PartnerStatusBadge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { listPartners } from "@/lib/partner-queries";

import { createPartnerAction, renamePartnerAction, setPartnerActiveAction } from "./actions";

export const metadata: Metadata = { title: "Partners" };

type PartnersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES: Record<string, string> = {
  created: "Partner created. It is now available in the sale form.",
  renamed: "Partner renamed. Historical sales show the new name.",
  activated: "Partner reactivated and available for new sales.",
  deactivated: "Partner deactivated. It no longer appears for new sales.",
};

function first(value: string | string[] | undefined): string | null {
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved ?? null;
}

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  await requireOwner();

  const params = await searchParams;
  const { partners, failed } = await listPartners();

  const noticeKey = first(params.notice);
  const notice = noticeKey ? NOTICES[noticeKey] : null;
  const error = first(params.error);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Owner tools"
        title="Partners"
        description="Create partners for sales, rename them, or deactivate the ones that no longer trade."
        actions={<ButtonLink href="#add-partner">Add partner</ButtonLink>}
      />

      {notice ? <Alert variant="success">{notice}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="card p-5" id="add-partner" aria-label="Add a partner">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">Add a partner</h2>
        <p className="mt-1 text-sm text-slate-500">
          Partner names are unique, case-insensitively. Deactivated partners can be reactivated.
        </p>

        <form action={createPartnerAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Partner name" htmlFor="partner-name" className="flex-1">
            <Input
              id="partner-name"
              name="name"
              maxLength={120}
              placeholder="City Traders"
              autoComplete="off"
              required
            />
          </Field>
          <SubmitButton className="btn btn-primary" pendingLabel="Adding…">
            Add partner
          </SubmitButton>
        </form>
      </section>

      <section className="card" aria-label="Partner list">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">All partners</h2>
            <p className="mt-1 text-sm text-slate-500">
              {partners.length} {partners.length === 1 ? "partner" : "partners"} · partners cannot be
              deleted, so history stays intact.
            </p>
          </div>
        </div>

        {failed ? (
          <div className="p-5">
            <Alert variant="error">Partners could not be loaded. Refresh to try again.</Alert>
          </div>
        ) : partners.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No partners yet"
              description="Add the first partner above, then record a sale against it."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {partners.map((partner) => (
              <li key={partner.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{partner.name}</p>
                      <PartnerStatusBadge active={partner.is_active} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Added {formatDate(partner.created_at.slice(0, 10))}
                    </p>
                  </div>

                  <form action={setPartnerActiveAction} className="shrink-0">
                    <Input type="hidden" name="partnerId" value={partner.id} />
                    <Input
                      type="hidden"
                      name="isActive"
                      value={partner.is_active ? "false" : "true"}
                    />
                    <SubmitButton
                      className="btn btn-secondary btn-sm"
                      pendingLabel={partner.is_active ? "Deactivating…" : "Reactivating…"}
                    >
                      {partner.is_active ? "Deactivate" : "Reactivate"}
                    </SubmitButton>
                  </form>
                </div>

                <details className="mt-3">
                  <summary className="w-fit cursor-pointer text-xs font-semibold text-brand-700 hover:text-brand-800">
                    Edit name
                  </summary>
                  <form
                    action={renamePartnerAction}
                    className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <Input type="hidden" name="partnerId" value={partner.id} />
                    <Label className="sr-only" htmlFor={`partner-name-${partner.id}`}>
                      New name for {partner.name}
                    </Label>
                    <Input
                      className="sm:max-w-sm"
                      id={`partner-name-${partner.id}`}
                      name="name"
                      defaultValue={partner.name}
                      maxLength={120}
                      required
                    />
                    <SubmitButton className="btn btn-secondary btn-sm" pendingLabel="Saving…">
                      Save name
                    </SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert variant="info">
        Historical sales always keep their partner reference. Deactivating a partner hides it from
        new sales without rewriting the past.
      </Alert>
    </div>
  );
}
