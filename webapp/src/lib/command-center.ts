import type {
  RepairOrder,
  BusinessDocument,
  Customer as GarageCustomer,
  Intervention,
  Incident,
  Contract,
  ClientSite,
  Ticket,
  Project,
  PurchaseOrder,
  InventoryItem,
  Appointment,
} from "@/lib/supabase/types";

// "Votre entreprise aujourd'hui" — le Command Center de chaque verticale
// Business OS. Fonctions pures, zéro accès réseau : chaque fait/action/
// opportunité est dérivé des VRAIES lignes déjà chargées par la page (mêmes
// tables que le Dashboard existant). Rien n'est jamais inventé — une
// opportunité qui ne peut pas être calculée avec certitude n'est simplement
// pas affichée (jamais une valeur par défaut présentée comme réelle).

export interface CommandCenterAction {
  text: string;
  tab: string;
  detailId?: string;
  reason?: string;
  priority?: number;
}

export interface CommandCenterData {
  today: string[];
  actions: CommandCenterAction[];
  opportunities: CommandCenterAction[];
  blockers?: CommandCenterAction[];
  planning?: CommandCenterAction[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/**
 * Premier jour (hors aujourd'hui, hors dimanche) dans les `daysAhead`
 * prochains jours qui n'a RIEN de planifié — jamais retourné si le calendrier
 * est effectivement complet ou s'il n'y a pas assez de recul.
 */
function emptiestUpcomingDay(scheduledDates: string[], daysAhead = 7): { label: string } | null {
  const now = new Date();
  const counts = new Array(daysAhead).fill(0);
  for (const iso of scheduledDates) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const diff = daysBetween(now, d);
    if (diff >= 0 && diff < daysAhead) counts[diff] += 1;
  }
  for (let i = 1; i < daysAhead; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue; // dimanche
    if (counts[i] === 0) {
      return { label: d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) };
    }
  }
  return null;
}

function plural(n: number, s: string, p: string): string {
  return n > 1 ? p : s;
}

// ---------------------------------------------------------------------------
// GARAGE
// ---------------------------------------------------------------------------
export function computeGarageCommandCenter({
  repairOrders,
  documents,
  customers,
  vehicles,
}: {
  repairOrders: RepairOrder[];
  documents: BusinessDocument[];
  customers: GarageCustomer[];
  vehicles: { id: string; registration: string; customer_id: string | null; next_maintenance_on?:string|null }[];
}): CommandCenterData {
  const now = new Date();
  const active = repairOrders.filter((r) => !["done", "delivered"].includes(r.status));

  const arrivingToday = repairOrders.filter((r) => r.scheduled_at && isSameDay(new Date(r.scheduled_at), now));
  const inProgress = repairOrders.filter((r) => r.status === "in_progress");
  const waitingParts = repairOrders.filter((r) => r.status === "waiting_parts");
  const readyNotDelivered = repairOrders.filter((r) => r.status === "done");
  const pendingQuotes = documents.filter((d) => d.doc_type === "quote" && d.status === "sent");
  const overdueInvoices = documents.filter(
    (d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at && new Date(d.due_at) < now,
  );

  const today: string[] = [];
  if (arrivingToday.length > 0) today.push(`${arrivingToday.length} véhicule${plural(arrivingToday.length, "", "s")} attendu${plural(arrivingToday.length, "", "s")} aujourd'hui`);
  if (inProgress.length > 0) today.push(`${inProgress.length} réparation${plural(inProgress.length, "", "s")} en cours`);
  if (waitingParts.length > 0) today.push(`${waitingParts.length} véhicule${plural(waitingParts.length, "", "s")} bloqué${plural(waitingParts.length, "", "s")} par une pièce`);
  if (pendingQuotes.length > 0) today.push(`${pendingQuotes.length} devis en attente de réponse`);
  if (overdueInvoices.length > 0) today.push(`${overdueInvoices.length} facture${plural(overdueInvoices.length, "", "s")} en retard`);
  if (active.length === 0 && arrivingToday.length === 0) today.push("Aucun véhicule attendu aujourd'hui");

  const vehicleLabel = (id: string | null) => vehicles.find((v) => v.id === id)?.registration ?? null;
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? null;

  const actions: CommandCenterAction[] = [];
  for(const v of vehicles.filter(v=>v.next_maintenance_on && new Date(v.next_maintenance_on)<=new Date(now.getTime()+30*86400000))) actions.push({text:`Rappeler l’entretien de ${v.registration}`,tab:"vehicles",detailId:v.id,reason:`Date renseignée : ${v.next_maintenance_on}`});
  for (const r of waitingParts.slice(0, 5)) {
    actions.push({ text: `Commander la pièce manquante pour ${vehicleLabel(r.vehicle_id) ?? r.title}`, tab: "repair_orders", detailId: r.id });
  }
  for (const d of pendingQuotes.filter((d) => daysBetween(new Date(d.issued_at), now) >= 3).slice(0, 5)) {
    actions.push({ text: `Relancer le devis de ${customerName(d.customer_id) ?? d.number}`, tab: "quotes", detailId:d.id });
  }
  for (const r of readyNotDelivered.slice(0, 5)) {
    actions.push({ text: `Prévenir ${customerName(r.customer_id) ?? "le client"} que le véhicule est prêt`, tab: "repair_orders", detailId: r.id });
  }
  for (const d of overdueInvoices.slice(0, 5)) {
    actions.push({ text: `Relancer la facture ${d.number} (${customerName(d.customer_id) ?? "client"})`, tab: "invoices", detailId:d.id });
  }

  const opportunities: CommandCenterAction[] = [];
  const lastOrderByCustomer = new Map<string, Date>();
  for (const r of repairOrders) {
    if (!r.customer_id || (r.status !== "done" && r.status !== "delivered")) continue;
    const date = new Date(r.completed_at ?? r.scheduled_at ?? r.created_at);
    const existing = lastOrderByCustomer.get(r.customer_id);
    if (!existing || date > existing) lastOrderByCustomer.set(r.customer_id, date);
  }
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dormant = [...lastOrderByCustomer.entries()].filter(([, date]) => date < sixMonthsAgo);
  if (dormant.length > 0) {
    opportunities.push({ text: `${dormant.length} ancien${plural(dormant.length, "", "s")} client${plural(dormant.length, "", "s")} n'${plural(dormant.length, "a", "ont")} pas eu de passage depuis plus de 6 mois`, tab: "customers" });
  }
  const quietDay = emptiestUpcomingDay(active.filter((r) => r.scheduled_at).map((r) => r.scheduled_at as string));
  if (quietDay) opportunities.push({ text: `Le planning de ${quietDay.label} ne contient aucune entrée enregistrée — vérifiez la disponibilité avant de relancer d'anciens clients`, tab: "planning" });

  return { today, actions, opportunities,
 blockers: waitingParts.map(r=>({text:`${vehicleLabel(r.vehicle_id)??r.title} : pièces attendues`,tab:"repair_orders",detailId:r.id,reason:"Ordre en attente de pièces",priority:3})),
 planning: active.filter(r=>r.scheduled_at && new Date(r.scheduled_at)>=startOfDay(now)).sort((a,b)=>a.scheduled_at!.localeCompare(b.scheduled_at!)).slice(0,8).map(r=>({text:`${r.title} · ${new Date(r.scheduled_at!).toLocaleString("fr-FR")}`,tab:"repair_orders",detailId:r.id})) };
}

// ---------------------------------------------------------------------------
// NETTOYAGE
// ---------------------------------------------------------------------------
export function computeCleaningCommandCenter({
  interventions,
  incidents,
  contracts,
}: {
  interventions: Intervention[];
  incidents: Incident[];
  contracts: Contract[];
}): CommandCenterData {
  const now = new Date();
  const today_ = interventions.filter((i) => i.status === "planned" && isSameDay(new Date(i.scheduled_at), now));
  const overduePlanned = interventions.filter((i) => i.status === "planned" && new Date(i.scheduled_at) < now);
  const openIncidents = incidents.filter((i) => i.status === "open");
  const criticalIncidents = openIncidents.filter((i) => i.severity === "high");
  const renewing = contracts.filter((c) => c.status === "ending_soon" || c.status === "active" && c.renewal_date && new Date(c.renewal_date).getTime() <= now.getTime()+30*86400000);

  const today: string[] = [];
  if (today_.length > 0) today.push(`${today_.length} intervention${plural(today_.length, "", "s")} prévue${plural(today_.length, "", "s")} aujourd'hui`);
  if (overduePlanned.length > 0) today.push(`${overduePlanned.length} intervention${plural(overduePlanned.length, "", "s")} non réalisée${plural(overduePlanned.length, "", "s")}`);
  if (openIncidents.length > 0) today.push(`${openIncidents.length} incident${plural(openIncidents.length, "", "s")} ouvert${plural(openIncidents.length, "", "s")}`);
  if (renewing.length > 0) today.push(`${renewing.length} contrat${plural(renewing.length, "", "s")} à renouveler`);
  if (today_.length === 0 && overduePlanned.length === 0) today.push("Aucune intervention en attente aujourd'hui");

  const actions: CommandCenterAction[] = [];
  for (const i of overduePlanned.slice(0, 5)) {
    actions.push({ text: `Reprogrammer l'intervention du ${new Date(i.scheduled_at).toLocaleDateString("fr-FR")}`, tab: "interventions", detailId:i.id });
  }
  for (const i of criticalIncidents.slice(0, 5)) {
    actions.push({ text: `Traiter l'incident grave : ${i.title}`, tab: "incidents", detailId:i.id });
  }
  for (const c of renewing.slice(0, 5)) {
    actions.push({ text: `Relancer le renouvellement du contrat ${c.site_name}`, tab: "contracts", detailId:c.id });
  }

  const opportunities: CommandCenterAction[] = [];
  const quietDay = emptiestUpcomingDay(interventions.filter((i) => i.status === "planned").map((i) => i.scheduled_at));
  if (quietDay) opportunities.push({ text: `Le planning de ${quietDay.label} ne contient aucune entrée enregistrée — vérifiez la disponibilité avant de une intervention supplémentaire`, tab: "planning" });
  const activeNoUpcoming = contracts.filter(
    (c) => c.status === "active" && !interventions.some((i) => i.contract_id === c.id && i.status === "planned" && new Date(i.scheduled_at) >= now),
  );
  if (activeNoUpcoming.length > 0) {
    opportunities.push({ text: `${activeNoUpcoming.length} contrat${plural(activeNoUpcoming.length, "", "s")} actif${plural(activeNoUpcoming.length, "", "s")} sans intervention planifiée à venir`, tab: "contracts" });
  }

  return { today, actions, opportunities,
 blockers: interventions.filter(i=>i.status === "planned" && !i.team_member_id).map(i=>({text:`Intervention non couverte · ${new Date(i.scheduled_at).toLocaleString("fr-FR")}`,tab:"interventions",detailId:i.id,reason:"Aucun membre d’équipe affecté",priority:3})),
 planning: interventions.filter(i=>i.status === "planned" && new Date(i.scheduled_at)>=startOfDay(now)).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)).slice(0,8).map(i=>({text:`Intervention · ${new Date(i.scheduled_at).toLocaleString("fr-FR")}`,tab:"interventions",detailId:i.id})) };
}

// ---------------------------------------------------------------------------
// AGENCE WEB
// ---------------------------------------------------------------------------
export function computeAgencyCommandCenter({
  sites,
  tickets,
  projects,
  documents,
  tasks = [],
}: {
  sites: ClientSite[];
  tickets: Ticket[];
  tasks?: import("@/lib/supabase/types").Task[];
  projects: Project[];
  documents: BusinessDocument[];
}): CommandCenterData {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);
  const domainsExpiring = sites.filter((s) => s.domain_renewal_date && new Date(s.domain_renewal_date) < in30Days);
  const hostingExpiring = sites.filter((s) => s.hosting_renewal_date && new Date(s.hosting_renewal_date) < in30Days);
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const urgentTickets = openTickets.filter((t) => t.priority === "urgent" || t.priority === "high");
  const overdueProjects = projects.filter((p) => p.deadline && new Date(p.deadline) < now && p.status !== "done");
  const overdueInvoices = documents.filter(
    (d) => d.doc_type === "invoice" && d.status !== "paid" && d.status !== "canceled" && d.due_at && new Date(d.due_at) < now,
  );

  const today: string[] = [];
  if (domainsExpiring.length > 0) today.push(`${domainsExpiring.length} domaine${plural(domainsExpiring.length, "", "s")} expirant sous 30 jours`);
  if (hostingExpiring.length > 0) today.push(`${hostingExpiring.length} hébergement${plural(hostingExpiring.length, "", "s")} expirant sous 30 jours`);
  if (openTickets.length > 0) today.push(`${openTickets.length} ticket${plural(openTickets.length, "", "s")} ouvert${plural(openTickets.length, "", "s")}${urgentTickets.length > 0 ? ` (${urgentTickets.length} prioritaire${plural(urgentTickets.length, "", "s")})` : ""}`);
  if (overdueProjects.length > 0) today.push(`${overdueProjects.length} projet${plural(overdueProjects.length, "", "s")} en retard`);
  if (overdueInvoices.length > 0) today.push(`${overdueInvoices.length} facture${plural(overdueInvoices.length, "", "s")} en retard`);
  if (today.length === 0) today.push("Rien d'urgent aujourd'hui");

  const siteLabel = (s: ClientSite) => s.domain_name || s.id.slice(0, 8);
  const actions: CommandCenterAction[] = [];
  for (const s of domainsExpiring.slice(0, 3)) actions.push({ text: `Renouveler le domaine ${siteLabel(s)}`, tab: "sites", detailId:s.id });
  for (const s of hostingExpiring.slice(0, 3)) actions.push({ text: `Renouveler l'hébergement de ${siteLabel(s)}`, tab: "sites", detailId:s.id });
  for (const p of overdueProjects.slice(0, 5)) actions.push({ text: `Relancer le projet ${p.name}`, tab: "projects", detailId:p.id });
  for (const t of urgentTickets.slice(0, 5)) actions.push({ text: `Traiter le ticket prioritaire : ${t.title}`, tab: "tickets", detailId:t.id });
  for (const d of overdueInvoices.slice(0, 5)) actions.push({ text: `Relancer la facture ${d.number}`, tab: "invoices", detailId:d.id });

  for(const task of tasks.filter(t=>t.blocked && !t.done)) actions.unshift({text:`Débloquer la tâche : ${task.title}`,tab:"production",reason:"Blocage signalé sur cette tâche",priority:3});
  for(const site of sites.filter(s=>s.next_maintenance_at && new Date(s.next_maintenance_at)<=in30Days)) actions.push({text:`Préparer la maintenance de ${siteLabel(site)}`,tab:"sites",detailId:site.id,reason:`Échéance : ${site.next_maintenance_at}`});
  const opportunities: CommandCenterAction[] = [];
  const staleSites = sites.filter((s) => s.status === "active" && !s.next_maintenance_at);
  if (staleSites.length > 0) {
    opportunities.push({ text: `${staleSites.length} site${plural(staleSites.length, "", "s")} actif${plural(staleSites.length, "", "s")} sans maintenance planifiée`, tab: "sites" });
  }
  const quietDay = emptiestUpcomingDay(projects.filter((p) => p.deadline).map((p) => p.deadline as string));
  if (quietDay) opportunities.push({ text: `Aucune échéance prévue ${quietDay.label} — bon créneau pour avancer sur un projet en retard`, tab: "projects" });

  return { today, actions, opportunities,
 blockers: overdueProjects.map(p=>({text:`Projet en retard : ${p.name}`,tab:"projects",detailId:p.id,reason:`Échéance enregistrée : ${p.deadline}`,priority:2})),
 planning: projects.filter(p=>p.deadline && p.status!=="done").sort((a,b)=>a.deadline!.localeCompare(b.deadline!)).slice(0,8).map(p=>({text:`${p.name} · ${p.deadline}`,tab:"projects",detailId:p.id})) };
}

// ---------------------------------------------------------------------------
// RESTAURANT
// ---------------------------------------------------------------------------
export function computeRestaurantCommandCenter({
  appointments,
  inventory,
  purchaseOrders,
}: {
  appointments: Appointment[];
  inventory: InventoryItem[];
  purchaseOrders: PurchaseOrder[];
}): CommandCenterData {
  const now = new Date();
  const todayAppointments = appointments.filter((a) => isSameDay(new Date(a.starts_at), now));
  const lowStock = inventory.filter((i) => i.low_stock_threshold != null && i.quantity <= i.low_stock_threshold);
  const pendingOrders = purchaseOrders.filter((p) => p.status === "ordered");
  const staleOrders = pendingOrders.filter((p) => p.ordered_at && daysBetween(new Date(p.ordered_at), now) > 7);

  const today: string[] = [];
  if (todayAppointments.length > 0) today.push(`${todayAppointments.length} réservation${plural(todayAppointments.length, "", "s")} prévue${plural(todayAppointments.length, "", "s")} aujourd'hui`);
  if (lowStock.length > 0) today.push(`${lowStock.length} ingrédient${plural(lowStock.length, "", "s")} en stock faible`);
  if (pendingOrders.length > 0) today.push(`${pendingOrders.length} commande${plural(pendingOrders.length, "", "s")} fournisseur en attente`);
  if (today.length === 0) today.push("Rien d'urgent côté stock ou réservations aujourd'hui");

  const actions: CommandCenterAction[] = [];
  for (const p of staleOrders.slice(0, 5)) actions.push({ text: `Relancer la commande fournisseur passée le ${new Date(p.ordered_at!).toLocaleDateString("fr-FR")}`, tab: "purchase_orders", detailId:p.id });
  for (const i of lowStock.slice(0, 5)) actions.push({ text: `Commander ${i.name} (${i.quantity} ${i.unit} restant${plural(i.quantity, "", "s")})`, tab: "inventory", detailId:i.id });

  const opportunities: CommandCenterAction[] = [];
  const quietDay = emptiestUpcomingDay(appointments.map((a) => a.starts_at));
  if (quietDay) opportunities.push({ text: `Service de ${quietDay.label} sans réservation enregistrée — vérifiez le remplissage avant de une offre spéciale`, tab: "planning" });

  return { today, actions, opportunities,
 blockers: lowStock.map(i=>({text:`${i.name} : ${i.quantity} ${i.unit}`,tab:"inventory",detailId:i.id,reason:`Au seuil ou sous le seuil de ${i.low_stock_threshold} ${i.unit}`,priority:3})),
 planning: appointments.filter(a=>new Date(a.starts_at)>=startOfDay(now)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at)).slice(0,8).map(a=>({text:`${a.title} · ${new Date(a.starts_at).toLocaleString("fr-FR")}`,tab:"planning",detailId:a.id})) };
}

export function hasAnythingToShow(data: CommandCenterData): boolean {
  return data.today.length > 0 || data.actions.length > 0 || data.opportunities.length > 0;
}

