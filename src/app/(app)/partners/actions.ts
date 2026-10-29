"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { describeDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { parsePartnerActive, parsePartnerName, parseUuid } from "@/lib/validation";

function partnersRedirect(params: { notice?: string; error?: string }): never {
  const search = new URLSearchParams();
  if (params.notice) search.set("notice", params.notice);
  if (params.error) search.set("error", params.error);
  const query = search.toString();
  redirect(query ? `/partners?${query}` : "/partners");
}

async function requireOwner() {
  const profile = await requireProfile();
  if (profile.role !== "owner") {
    redirect("/dashboard?notice=forbidden");
  }
  return profile;
}

function formPartnerId(formData: FormData): string | null {
  const value = formData.get("partnerId");
  return typeof value === "string" ? parseUuid(value) : null;
}

function revalidatePartnerSurfaces() {
  revalidatePath("/partners");
  revalidatePath("/memos");
  revalidatePath("/memos/new");
  revalidatePath("/reports");
  revalidatePath("/dashboard");
}

export async function createPartnerAction(formData: FormData): Promise<void> {
  await requireOwner();

  const name = parsePartnerName(formData.get("name"));
  if (!name) {
    partnersRedirect({ error: "Enter a partner name of 120 characters or fewer." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("partners").insert({ name });

  if (error) {
    partnersRedirect({ error: describeDbError(error, "Could not create the partner.") });
  }

  revalidatePartnerSurfaces();
  partnersRedirect({ notice: "created" });
}

export async function renamePartnerAction(formData: FormData): Promise<void> {
  await requireOwner();

  const partnerId = formPartnerId(formData);
  const name = parsePartnerName(formData.get("name"));

  if (!partnerId || !name) {
    partnersRedirect({ error: "Choose a partner and enter a valid name." });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .update({ name })
    .eq("id", partnerId)
    .select("id");

  if (error) {
    partnersRedirect({ error: describeDbError(error, "Could not rename the partner.") });
  }

  if (!data || data.length === 0) {
    partnersRedirect({ error: "That partner no longer exists." });
  }

  revalidatePartnerSurfaces();
  partnersRedirect({ notice: "renamed" });
}

export async function setPartnerActiveAction(formData: FormData): Promise<void> {
  await requireOwner();

  const partnerId = formPartnerId(formData);
  const isActive = parsePartnerActive(formData.get("isActive"));

  if (!partnerId || isActive === null) {
    partnersRedirect({ error: "Choose a partner and a valid status." });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .update({ is_active: isActive })
    .eq("id", partnerId)
    .select("id");

  if (error) {
    partnersRedirect({ error: describeDbError(error, "Could not update the partner.") });
  }

  if (!data || data.length === 0) {
    partnersRedirect({ error: "That partner no longer exists." });
  }

  revalidatePartnerSurfaces();
  partnersRedirect({ notice: isActive ? "activated" : "deactivated" });
}
