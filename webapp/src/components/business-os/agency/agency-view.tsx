"use client";

import { AgencyProduction } from "@/components/business-os/agency/agency-production";

import { useMemo, useState } from "react";
import type { Customer, Project, ClientSite, Ticket, Task, TeamMember, BusinessDocument, DocumentItem, PlanningEntry } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { computeAgencyAlerts } from "@/lib/agency";
import { computeAgencyCommandCenter } from "@/lib/command-center";
import { makeDocumentHandlers } from "@/lib/business-os-handlers/document-handlers";
import { makePlanningHandlers } from "@/lib/business-os-handlers/planning-handlers";
import { CommandCenter } from "@/components/business-os/command-center";
import { CustomersModule } from "@/components/business-os/customers-module";
import { TeamModule } from "@/components/business-os/team-module";
import { DocumentsModule } from "@/components/business-os/documents-module";
import { ProjectsModule } from "@/components/business-os/agency/agency-projects";
import { SitesModule } from "@/components/business-os/agency/agency-sites";
import { TicketsModule } from "@/components/business-os/agency/agency-tickets";
import { TasksModule } from "@/components/business-os/agency/agency-tasks";
import { PlanningModule } from "@/components/business-os/agency/agency-planning";
import { AgencyDashboard } from "@/components/business-os/agency/agency-dashboard";

type Tab = "production" | "today" | "dashboard" | "customers" | "projects" | "sites" | "tickets" | "tasks" | "planning" | "team" | "quotes" | "invoices";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "production", label: "Production" },
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Clients" },
  { key: "projects", label: "Projets" },
  { key: "sites", label: "Sites" },
  { key: "tickets", label: "Tickets" },
  { key: "tasks", label: "Tâches" },
  { key: "planning", label: "Planning" },
  { key: "team", label: "Équipe" },
  { key: "quotes", label: "Devis" },
  { key: "invoices", label: "Factures" },
];

export function AgencyView({
  workspaceId,
  isAdvanced,
  initialCustomers,
  initialProjects,
  initialSites,
  initialTickets,
  initialTasks,
  initialTeamMembers,
  initialDocuments,
  initialDocumentItems,
  initialPlanningEntries,
}: {
  workspaceId: string;
  isAdvanced: boolean;
  initialCustomers: Customer[];
  initialProjects: Project[];
  initialSites: ClientSite[];
  initialTickets: Ticket[];
  initialTasks: Task[];
  initialTeamMembers: TeamMember[];
  initialDocuments: BusinessDocument[];
  initialDocumentItems: DocumentItem[];
  initialPlanningEntries: PlanningEntry[];
}) {
  const supabase = createClient();
  const [mutationError,setMutationError]=useState<string|null>(null);
  const [focusId,setFocusId]=useState<string|null>(null);
  const [active, setActive] = useState<Tab>("today");

  const [customers, setCustomers] = useState(initialCustomers);
  const [projects, setProjects] = useState(initialProjects);
  const [sites, setSites] = useState(initialSites);
  const [tickets, setTickets] = useState(initialTickets);
  const [tasks, setTasks] = useState(initialTasks);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentItems, setDocumentItems] = useState<Record<string, DocumentItem[]>>(() => {
    const map: Record<string, DocumentItem[]> = {};
    for (const item of initialDocumentItems) (map[item.document_id] ??= []).push(item);
    return map;
  });

  const { createDocument, deleteDraftDocument, convertQuoteToInvoice } = makeDocumentHandlers({
    supabase,
    workspaceId,
    linkField: "project_id",
    getDocuments: () => documents,
    setDocuments,
    getDocumentItems: () => documentItems,
    setDocumentItems,
    setMutationError,
  });

  const [planningEntries, setPlanningEntries] = useState(initialPlanningEntries);
  const { createPlanningEntry, updatePlanningEntry, deletePlanningEntry } = makePlanningHandlers({
    supabase,
    workspaceId,
    setEntries: setPlanningEntries,
    setMutationError,
  });

  const alerts = useMemo(() => computeAgencyAlerts({ sites, projects, tickets }, isAdvanced), [sites, projects, tickets, isAdvanced]);
  const commandCenter = useMemo(() => computeAgencyCommandCenter({ sites, tickets, projects, documents, tasks }), [sites, tickets, projects, documents, tasks]);

  function handleCommandCenterNavigate(tab: string, detailId?:string) {
    setFocusId(detailId??null);
    setActive(tab as Tab);
  }

  async function patchTask(id:string,patch:Partial<Task>) {
    const {error}=await supabase.from("tasks").update(patch).eq("workspace_id",workspaceId).eq("id",id);
    if(error) {setMutationError(error.message);return;}
    setTasks(prev=>prev.map(t=>t.id===id?{...t,...patch}:t));
  }

  async function createCustomer(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase.from("customers").insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() }).select("*").single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setCustomers((prev) => [data, ...prev]);
  }
  async function updateCustomer(id: string, patch: Partial<Customer>) {
    const { error } = await supabase.from("customers").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function removeCustomer(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("customers").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("customers").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  async function createProject(input: { name: string; projectType: Project["project_type"]; customerId: string; deadline: string; budget: string; notes: string }) {
    const { data, error } = await supabase
      .from("projects")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), project_type: input.projectType, customer_id: input.customerId || null, deadline: input.deadline || null, budget: input.budget ? Number(input.budget) : null, notes: input.notes.trim() })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setProjects((prev) => [data, ...prev]);
  }
  async function updateProject(id: string, patch: Partial<Project>) {
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  async function removeProject(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("projects").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  async function createSite(input: { domainName: string; hostingProvider: string; customerId: string; projectId: string; domainRenewalDate: string; hostingRenewalDate: string; nextMaintenanceAt: string; monthlyPrice: string; notes: string }) {
    const { data, error } = await supabase
      .from("client_sites")
      .insert({
        workspace_id: workspaceId,
        domain_name: input.domainName.trim(),
        hosting_provider: input.hostingProvider.trim(),
        customer_id: input.customerId || null,
        project_id: input.projectId || null,
        domain_renewal_date: input.domainRenewalDate || null,
        hosting_renewal_date: input.hostingRenewalDate || null,
        next_maintenance_at: input.nextMaintenanceAt || null,
        monthly_price: Number(input.monthlyPrice) || 0,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setSites((prev) => [data, ...prev]);
  }
  async function updateSite(id: string, patch: Partial<ClientSite>) {
    const { error } = await supabase.from("client_sites").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setSites((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function removeSite(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("client_sites").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("client_sites").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setSites((prev) => prev.filter((s) => s.id !== id));
  }

  async function createTicket(input: { title: string; customerId: string; siteId: string; priority: Ticket["priority"]; notes: string }) {
    const { data, error } = await supabase
      .from("tickets")
      .insert({ workspace_id: workspaceId, title: input.title.trim(), customer_id: input.customerId || null, site_id: input.siteId || null, priority: input.priority, notes: input.notes.trim() })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setTickets((prev) => [data, ...prev]);
  }
  async function updateTicket(id: string, patch: Partial<Ticket>) {
    const { error } = await supabase.from("tickets").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function removeTicket(id: string) {
    const { error } = await supabase.from("tickets").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTickets((prev) => prev.filter((t) => t.id !== id));
  }

  async function createTask(input: { title: string; projectId: string; dueDate: string }) {
    const { data, error } = await supabase.from("tasks").insert({ workspace_id: workspaceId, title: input.title.trim(), project_id: input.projectId || null, due_date: input.dueDate || null }).select("*").single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setTasks((prev) => [data, ...prev]);
  }
  async function toggleTask(id: string, done: boolean) {
    const { error } = await supabase.from("tasks").update({ done }).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
  }
  async function removeTask(id: string) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function createTeamMember(input: { name: string; role: string; phone: string; email: string }) {
    const { data, error } = await supabase.from("team_members").insert({ workspace_id: workspaceId, name: input.name.trim(), role: input.role.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null }).select("*").single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setTeamMembers((prev) => [...prev, data]);
  }
  async function updateTeamMember(id: string, patch: Partial<TeamMember>) {
    const { error } = await supabase.from("team_members").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTeamMembers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function removeTeamMember(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("team_members").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("team_members").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setTeamMembers((prev) => prev.filter((t) => t.id !== id));
  }

  async function createInvoiceFromProject(project: Project) {
    const yearCount = documents.filter((d) => d.doc_type === "invoice" && new Date(d.issued_at).getFullYear() === new Date().getFullYear()).length;
    const number = `FAC-${new Date().getFullYear()}-${String(yearCount + 1).padStart(4, "0")}`;
    const amount = project.budget ?? 0;
    const { data, error } = await supabase
      .from("documents")
      .insert({ workspace_id: workspaceId, doc_type: "invoice", project_id: project.id, customer_id: project.customer_id, number, total_ht: amount, total_ttc: amount, status: "draft" })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setDocuments((prev) => [data, ...prev]);
  }

  async function setDocumentStatus(doc: BusinessDocument, status: BusinessDocument["status"]) {
    const patch: Partial<BusinessDocument> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("documents").update(patch).eq("id", doc.id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...patch } : d)));
  }

  return (
    <div className="flex flex-col gap-5">
      {mutationError && <p role="alert" className="rounded-xl bg-red-bg p-3 text-sm text-red-fg">{mutationError}</p>}
      <div className="pf-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {setFocusId(null);setActive(t.key);}}
            aria-current={active===t.key?"page":undefined}
            className={cn("rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition-colors", active === t.key ? "bg-panel text-ink shadow-[0_1px_0_0_var(--panel)]" : "text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "today" && <CommandCenter data={commandCenter} onNavigate={handleCommandCenterNavigate} entityName="agence" />}
      {active === "production" && <AgencyProduction projects={projects} tasks={tasks} customers={customers} sites={sites} onProject={updateProject} onTask={patchTask} onNavigate={handleCommandCenterNavigate} />}
      {active === "dashboard" && <AgencyDashboard sites={sites} projects={projects} tickets={tickets} alerts={alerts} />}
      {active === "customers" && (
        <CustomersModule workspaceId={workspaceId} initial={customers} label="Clients" controlled={{ rows: customers, onCreate: createCustomer, onUpdate: updateCustomer, onRemove: removeCustomer }} />
      )}
      {active === "projects" && (
        <ProjectsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          rows={projects}
          customers={customers}
          documents={documents}
          onCreate={createProject}
          onUpdate={updateProject}
          onRemove={removeProject}
          onCreateInvoice={createInvoiceFromProject}
        />
      )}
      {active === "sites" && <SitesModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={sites} customers={customers} projects={projects} onCreate={createSite} onUpdate={updateSite} onRemove={removeSite} />}
      {active === "tickets" && <TicketsModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={tickets} customers={customers} sites={sites} onCreate={createTicket} onUpdate={updateTicket} onRemove={removeTicket} />}
      {active === "tasks" && <TasksModule rows={tasks} projects={projects} onCreate={createTask} onToggle={toggleTask} onRemove={removeTask} />}
      {active === "planning" && (
        <PlanningModule
          tasks={tasks}
          projects={projects}
          entries={planningEntries}
          customers={customers}
          teamMembers={teamMembers}
          onCreateEntry={createPlanningEntry}
          onUpdateEntryStatus={(id, status) => updatePlanningEntry(id, { status })}
          onDeleteEntry={deletePlanningEntry}
        />
      )}
      {active === "team" && <TeamModule label="Équipe" rows={teamMembers} onCreate={createTeamMember} onUpdate={updateTeamMember} onRemove={removeTeamMember} />}
      {active === "quotes" && (
        <DocumentsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          docType="quote"
          rows={documents}
          itemsByDocument={documentItems}
          customers={customers}
          resolveLinkedLabel={(d) => (d.project_id ? projects.find((p) => p.id === d.project_id)?.name ?? "—" : "—")}
          emptyHint="Devis créés manuellement ou liés à un projet."
          onSetStatus={setDocumentStatus}
          onCreate={(input) => createDocument("quote", input)}
          onDeleteDraft={deleteDraftDocument}
          onConvertToInvoice={convertQuoteToInvoice}
          linkLabel="Projet"
          linkOptions={projects.map((p) => ({ id: p.id, label: p.name }))}
        />
      )}
      {active === "invoices" && (
        <DocumentsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          docType="invoice"
          rows={documents}
          itemsByDocument={documentItems}
          customers={customers}
          resolveLinkedLabel={(d) => (d.project_id ? projects.find((p) => p.id === d.project_id)?.name ?? "—" : "—")}
          emptyHint="Créez une facture manuellement, ou depuis un projet (montant repris du budget)."
          onSetStatus={setDocumentStatus}
          onCreate={(input) => createDocument("invoice", input)}
          onDeleteDraft={deleteDraftDocument}
          linkLabel="Projet"
          linkOptions={projects.map((p) => ({ id: p.id, label: p.name }))}
        />
      )}
    </div>
  );
}

