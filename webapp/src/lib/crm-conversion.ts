import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Prospect } from "@/lib/supabase/types";
export async function convertWonProspectToCustomer(supabase: SupabaseClient<Database>, prospect: Prospect): Promise<string | null> {
 if (prospect.converted_customer_id) return prospect.converted_customer_id;
 const { data, error } = await supabase.rpc("convert_won_prospect", { p_prospect_id: prospect.id });
 if (error) throw new Error("Conversion client impossible : " + error.message);
 return data;
}
