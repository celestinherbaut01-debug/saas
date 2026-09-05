import type { AutomationSettings } from "@/lib/session";

// Insights "proactifs" NOVA Métier : calculés en direct depuis les vraies
// données Business OS (jamais stockés, jamais inventés), filtrés par les
// préférences de rappel du workspace (automation_settings). Portée
// volontairement limitée : ceci décide QUOI signaler — l'envoi réel (SMS/
// email) est une intégration ultérieure, pas encore branchée (voir migration
// 0024_automation_settings.sql). L'action de chaque insight ouvre NOVA avec
// une question pré-remplie (réutilise le mécanisme initialPrompt existant de
// /agent) : NOVA répond avec les vrais noms/coordonnées via ses outils —
// jamais un faux bouton "Envoyer" qui n'enverrait rien.
export interface ProactiveInsight {
  icon: string;
  text: string;
  actionLabel: string;
  actionHref: string;
  level: "info" | "warning";
}

function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60);
}

function countUpcoming(dates: string[], withinHours: number): number {
  return dates.filter((d) => {
    const h = hoursUntil(d);
    return h >= 0 && h <= withinHours;
  }).length;
}

function plural(count: number, singular: string, forPlural: string): string {
  return count > 1 ? forPlural : singular;
}

function askNovaHref(prompt: string): string {
  return `/agent?prompt=${encodeURIComponent(prompt)}`;
}

/** Un insight par rappel ACTIVÉ (24h / 2h / personnalisé) qui a effectivement quelque chose à signaler. */
export function buildAppointmentInsights(scheduledDates: string[], settings: AutomationSettings): ProactiveInsight[] {
  const insights: ProactiveInsight[] = [];
  const windows: Array<{ enabled: boolean; hours: number; icon: string; level: "info" | "warning"; suffix: string }> = [
    { enabled: settings.appointment_reminder_24h, hours: 24, icon: "🕑", level: "info", suffix: "dans les 24h" },
    { enabled: settings.appointment_reminder_2h, hours: 2, icon: "⏰", level: "warning", suffix: "dans les 2h" },
    {
      enabled: settings.custom_reminder_hours_before != null,
      hours: settings.custom_reminder_hours_before ?? 0,
      icon: "🔔",
      level: "info",
      suffix: `dans les ${settings.custom_reminder_hours_before}h (rappel personnalisé)`,
    },
  ];
  for (const w of windows) {
    if (!w.enabled) continue;
    const count = countUpcoming(scheduledDates, w.hours);
    if (count === 0) continue;
    insights.push({
      icon: w.icon,
      text: `${count} ${plural(count, "rendez-vous prévu", "rendez-vous prévus")} ${w.suffix}`,
      actionLabel: "Qui contacter ?",
      actionHref: askNovaHref(`Qui a un rendez-vous dans les ${w.hours} prochaines heures ? Donne-moi leurs coordonnées pour les prévenir.`),
      level: w.level,
    });
  }
  return insights;
}

export function buildLowStockInsight(lowStockCount: number, settings: AutomationSettings): ProactiveInsight | null {
  if (!settings.low_stock_alert || lowStockCount === 0) return null;
  return {
    icon: "📦",
    text: `${lowStockCount} ${plural(lowStockCount, "article en stock faible", "articles en stock faible")}`,
    actionLabel: "Voir le détail",
    actionHref: askNovaHref("Quels articles sont en stock faible en ce moment ?"),
    level: "warning",
  };
}

export function buildRenewalInsight(renewalCount: number, settings: AutomationSettings): ProactiveInsight | null {
  if (!settings.renewal_alert || renewalCount === 0) return null;
  return {
    icon: "📅",
    text: `${renewalCount} ${plural(renewalCount, "renouvellement à prévoir bientôt", "renouvellements à prévoir bientôt")}`,
    actionLabel: "Voir le détail",
    actionHref: askNovaHref("Quels renouvellements (domaines, hébergements) arrivent bientôt ?"),
    level: "warning",
  };
}
