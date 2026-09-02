"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SettingsActionState {
  error: string | null;
  ok?: boolean;
}

export async function updateBusinessProfile(
  workspaceId: string,
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { error } = await supabase
    .from("business_profiles")
    .update({
      company_name: String(formData.get("company_name") || ""),
      website: String(formData.get("website") || "") || null,
      offer_description: String(formData.get("offer_description") || ""),
    })
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };
  revalidatePath("/parametres");
  return { error: null, ok: true };
}
