import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Prospect } from "@/lib/supabase/types";

// Connexion Prospection → Business OS : un prospect marqué "Gagné" devient un
// vrai client Business OS (table `customers`, partagée par toutes les
// verticales) — jamais une simple étiquette sans suite. Idempotent via
// `converted_customer_id` : un aller-retour de statut (gagné → perdu →
// gagné) ne crée jamais un deuxième client en double.
export async function convertWonProspectToCustomer(
  supabase: SupabaseClient<Database>,
  prospect: Prospect,
): Promise<string | null> {
  if (prospect.converted_customer_id) return prospect.converted_customer_id;

  const { data: customer, error: insertError } = await supabase
    .from("customers")
    .insert({
      workspace_id: prospect.workspace_id,
      name: prospect.company_name,
      phone: prospect.phone,
      email: null,
      notes: `Converti depuis Prospection le ${new Date().toLocaleDateString("fr-FR")}.`,
    })
    .select("id")
    .single();
  if (insertError || !customer) return null;

  const { error: linkError } = await supabase.from("prospects").update({ converted_customer_id: customer.id }).eq("id", prospect.id);
  if (linkError) return null;

  return customer.id;
}
