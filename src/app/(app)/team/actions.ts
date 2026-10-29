"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";
import { describeDbError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { parseRole, parseUuid } from "@/lib/validation";

function teamRedirect(params: { notice?: string; error?: string }): never {
  const search = new URLSearchParams();
  if (params.notice) search.set("notice", params.notice);
  if (params.error) search.set("error", params.error);
  const query = search.toString();
  redirect(query ? `/team?${query}` : "/team");
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  if (profile.role !== "owner") {
    redirect("/dashboard?notice=forbidden");
  }

  const rawUserId = formData.get("userId");
  const userId = typeof rawUserId === "string" ? parseUuid(rawUserId) : null;
  const role = parseRole(formData.get("role"));

  if (!userId || !role) {
    teamRedirect({ error: "Choose a valid user and role." });
  }

  if (userId === profile.id) {
    teamRedirect({ error: "You cannot change your own role from the Team page." });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_user_role", {
    p_user_id: userId,
    p_role: role,
  });

  if (error) {
    teamRedirect({ error: describeDbError(error, "Could not update the role.") });
  }

  revalidatePath("/team");
  revalidatePath("/dashboard");
  teamRedirect({ notice: "role-updated" });
}
