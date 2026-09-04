import type { Project, ClientSite, Ticket } from "@/lib/supabase/types";
import type { BadgeTone } from "@/components/ui/badge";
import { formatEUR } from "@/lib/format";

export { formatEUR };

export const PROJECT_STATUS_LABEL: Record<Project["status"], { text: string; tone: BadgeTone }> = {
  in_progress: { text: "En cours", tone: "accent" },
  maintenance: { text: "Maintenance", tone: "warning" },
  done: { text: "Livré", tone: "success" },
};

export const SITE_STATUS_LABEL: Record<ClientSite["status"], { text: string; tone: BadgeTone }> = {
  active: { text: "Actif", tone: "success" },
  maintenance: { text: "Maintenance", tone: "warning" },
  inactive: { text: "Inactif", tone: "neutral" },
};

export const TICKET_STATUS_LABEL: Record<Ticket["status"], { text: string; tone: BadgeTone }> = {
  open: { text: "Ouvert", tone: "warning" },
  in_progress: { text: "En cours", tone: "accent" },
  resolved: { text: "Résolu", tone: "success" },
  closed: { text: "Fermé", tone: "neutral" },
};

export const TICKET_PRIORITY_LABEL: Record<Ticket["priority"], { text: string; tone: BadgeTone }> = {
  low: { text: "Basse", tone: "neutral" },
  normal: { text: "Normale", tone: "accent" },
  high: { text: "Haute", tone: "warning" },
  urgent: { text: "Urgente", tone: "danger" },
};

export interface AgencyAlert {
  level: "danger" | "warning";
  text: string;
}

export function computeAgencyAlerts(
  { sites, projects, tickets }: { sites: ClientSite[]; projects: Project[]; tickets: Ticket[] },
  advanced: boolean,
): AgencyAlert[] {
  const alerts: AgencyAlert[] = [];
  const now = new Date().getTime();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;

  for (const s of sites) {
    if (s.domain_renewal_date && new Date(s.domain_renewal_date).getTime() < in30Days) {
      alerts.push({ level: "warning", text: `Domaine ${s.domain_name || s.id.slice(0, 8)} expire le ${new Date(s.domain_renewal_date).toLocaleDateString("fr-FR")}` });
    }
    if (s.hosting_renewal_date && new Date(s.hosting_renewal_date).getTime() < in30Days) {
      alerts.push({ level: "warning", text: `Hébergement de ${s.domain_name || s.id.slice(0, 8)} expire le ${new Date(s.hosting_renewal_date).toLocaleDateString("fr-FR")}` });
    }
    if (s.next_maintenance_at && new Date(s.next_maintenance_at).getTime() < now) {
      alerts.push({ level: "danger", text: `Maintenance en retard pour ${s.domain_name || s.id.slice(0, 8)}` });
    }
  }

  for (const p of projects) {
    if (p.deadline && new Date(p.deadline).getTime() < now && p.status !== "done") {
      alerts.push({ level: "danger", text: `Projet ${p.name} en retard (échéance le ${new Date(p.deadline).toLocaleDateString("fr-FR")})` });
    }
  }

  if (advanced) {
    for (const t of tickets) {
      if (t.status === "open" && (t.priority === "high" || t.priority === "urgent")) {
        alerts.push({ level: "danger", text: `Ticket prioritaire ouvert : ${t.title}` });
      }
    }
  }

  return alerts;
}
