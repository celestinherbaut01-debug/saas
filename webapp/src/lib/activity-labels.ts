import type { Activity } from "@/lib/supabase/types";

export const ACTIVITY_LABEL: Record<Activity["type"], string> = {
  added_to_crm: "Ajouté au CRM",
  status_change: "Statut changé",
  note: "Note ajoutée",
  email_sent: "Email envoyé",
  followup_sent: "Relance envoyée",
  reply_received: "Réponse reçue",
  call_logged: "Appel enregistré",
  google_verified: "Vérifié sur Google",
  website_audited: "Site audité",
  appointment_created: "Rendez-vous créé",
};
