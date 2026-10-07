"use client";

import { CleaningOperations } from "@/components/business-os/cleaning/cleaning-operations";

import { useMemo, useState } from "react";
import type { Customer, Site, Contract, Intervention, Incident, TeamMember, InventoryItem, BusinessDocument, DocumentItem } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { computeCleaningAlerts } from "@/lib/cleaning";
import { computeCleaningCommandCenter } from "@/lib/command-center";
import { makeDocumentHandlers } from "@/lib/business-os-handlers/document-handlers";
import { CommandCenter } from "@/components/business-os/command-center";
import { CustomersModule } from "@/components/business-os/customers-module";
import { InventoryModule } from "@/components/business-os/inventory-module";
import { TeamModule } from "@/components/business-os/team-module";
import { DocumentsModule } from "@/components/business-os/documents-module";
import { SitesModule } from "@/components/business-os/cleaning/cleaning-sites";
import { ContractsModule } from "@/components/business-os/cleaning/cleaning-contracts";
import { InterventionsModule } from "@/components/business-os/cleaning/cleaning-interventions";
import { PlanningModule } from "@/components/business-os/cleaning/cleaning-planning";
import { QualityModule } from "@/components/business-os/cleaning/cleaning-quality";
import { IncidentsModule } from "@/components/business-os/cleaning/cleaning-incidents";
import { CleaningDashboard } from "@/components/business-os/cleaning/cleaning-dashboard";

type Tab = "operations" | "today" | "dashboard" | "customers" | "sites" | "contracts" | "interventions" | "planning" | "quality" | "team" | "inventory" | "incidents" | "quotes" | "invoices";

const TABS: { key: Tab; label: string; advancedOnly?: boolean }[] = [
  { key: "today", label: "Aujourd'hui" },
  { key: "operations", label: "Exploitation" },
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Clients" },
  { key: "sites", label: "Sites" },
  { key: "contracts", label: "Contrats" },
  { key: "interventions", label: "Interventions" },
  { key: "planning", label: "Planning" },
  { key: "quality", label: "Qualité", advancedOnly: true },
  { key: "team", label: "Employés" },
  { key: "inventory", label: "Matériel & Stock" },
  { key: "incidents", label: "Incidents" },
  { key: "quotes", label: "Devis" },
  { key: "invoices", label: "Facturation" },
];

export function CleaningView({
  workspaceId,
  isAdvanced,
  initialCustomers,
  initialSites,
  initialContracts,
  initialInterventions,
  initialIncidents,
  initialTeamMembers,
  initialInventory,
  initialDocuments,
  initialDocumentItems,
}: {
  workspaceId: string;
  isAdvanced: boolean;
  initialCustomers: Customer[];
  initialSites: Site[];
  initialContracts: Contract[];
  initialInterventions: Intervention[];
  initialIncidents: Incident[];
  initialTeamMembers: TeamMember[];
  initialInventory: InventoryItem[];
  initialDocuments: BusinessDocument[];
  initialDocumentItems: DocumentItem[];
}) {
  const supabase = createClient();
  const [mutationError,setMutationError]=useState<string|null>(null);
  const [focusId,setFocusId]=useState<string|null>(null);
  const [active, setActive] = useState<Tab>("today");

  const [customers, setCustomers] = useState(initialCustomers);
  const [sites, setSites] = useState(initialSites);
  const [contracts, setContracts] = useState(initialContracts);
  const [interventions, setInterventions] = useState(initialInterventions);
  const [incidents, setIncidents] = useState(initialIncidents);
  const [teamMembers, setTeamMembers] = useState(initialTeamMembers);
  const [inventory, setInventory] = useState(initialInventory);
  const [documents, setDocuments] = useState(initialDocuments);
  const [documentItems, setDocumentItems] = useState<Record<string, DocumentItem[]>>(() => {
    const map: Record<string, DocumentItem[]> = {};
    for (const item of initialDocumentItems) (map[item.document_id] ??= []).push(item);
    return map;
  });

  const { createDocument, deleteDraftDocument, convertQuoteToInvoice } = makeDocumentHandlers({
    supabase,
    workspaceId,
    linkField: "contract_id",
    getDocuments: () => documents,
    setDocuments,
    getDocumentItems: () => documentItems,
    setDocumentItems,
    setMutationError,
  });

  const alerts = useMemo(() => computeCleaningAlerts({ contracts, interventions, incidents }, isAdvanced), [contracts, interventions, incidents, isAdvanced]);
  const commandCenter = useMemo(() => computeCleaningCommandCenter({ interventions, incidents, contracts }), [interventions, incidents, contracts]);

  function handleCommandCenterNavigate(tab: string, detailId?:string) {
    setFocusId(detailId??null);
    setActive(tab as Tab);
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

  async function createSite(input: { name: string; address: string; customerId: string; notes: string }) {
    const { data, error } = await supabase.from("sites").insert({ workspace_id: workspaceId, name: input.name.trim(), address: input.address.trim(), customer_id: input.customerId || null, notes: input.notes.trim() }).select("*").single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setSites((prev) => [data, ...prev]);
  }
  async function updateSite(id: string, patch: Partial<Site>) {
    const { error } = await supabase.from("sites").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setSites((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function removeSite(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("sites").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("sites").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setSites((prev) => prev.filter((s) => s.id !== id));
  }

  async function createContract(input: { siteId: string; siteName: string; customerId: string; frequency: string; monthlyPrice: string; renewalDate: string; notes: string }) {
    const site = input.siteId ? sites.find((s) => s.id === input.siteId) : null;
    const { data, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        site_id: input.siteId || null,
        site_name: site?.name ?? input.siteName.trim(),
        customer_id: input.customerId || (site?.customer_id ?? null),
        frequency: input.frequency.trim(),
        monthly_price: Number(input.monthlyPrice) || 0,
        renewal_date: input.renewalDate || null,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setContracts((prev) => [data, ...prev]);
  }
  async function updateContract(id: string, patch: Partial<Contract>) {
    const { error } = await supabase.from("contracts").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setContracts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function removeContract(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("contracts").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("contracts").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setContracts((prev) => prev.filter((c) => c.id !== id));
  }

  async function createIntervention(input: { contractId: string; siteId: string; teamMemberId: string; scheduledAt: string }) {
    const { data, error } = await supabase
      .from("interventions")
      .insert({
        workspace_id: workspaceId,
        contract_id: input.contractId || null,
        site_id: input.siteId || null,
        team_member_id: input.teamMemberId || null,
        scheduled_at: new Date(input.scheduledAt).toISOString(),
      })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setInterventions((prev) => [data, ...prev]);
  }
  async function updateIntervention(id: string, patch: Partial<Intervention>) {
    const { error } = await supabase.from("interventions").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setInterventions((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  async function removeIntervention(id: string) {
    const { error } = await supabase.from("interventions").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setInterventions((prev) => prev.filter((it) => it.id !== id));
  }

  async function createIncident(input: { title: string; siteId: string; severity: Incident["severity"]; notes: string }) {
    const { data, error } = await supabase.from("incidents").insert({ workspace_id: workspaceId, title: input.title.trim(), site_id: input.siteId || null, severity: input.severity, notes: input.notes.trim() }).select("*").single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setIncidents((prev) => [data, ...prev]);
  }
  async function updateIncident(id: string, patch: Partial<Incident>) {
    const { error } = await supabase.from("incidents").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function removeIncident(id: string) {
    const { error } = await supabase.from("incidents").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setIncidents((prev) => prev.filter((i) => i.id !== id));
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

  async function createInventoryItem(input: { name: string; quantity: string; unit: string; lowStockThreshold: string; unitCost: string; supplierId: string }) {
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), quantity: Number(input.quantity) || 0, unit: input.unit.trim() || "unité", low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null, unit_cost: Number(input.unitCost) || 0 })
      .select("*")
      .single();
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error && data) setInventory((prev) => [data, ...prev]);
  }
  async function updateInventoryItem(id: string, patch: Partial<InventoryItem>) {
    const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setInventory((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  async function removeInventoryItem(id: string, mode: "archive" | "delete") {
    const { error } =
      mode === "archive"
        ? await supabase.from("inventory_items").update({ archived_at: new Date().toISOString() }).eq("id", id)
        : await supabase.from("inventory_items").delete().eq("id", id);
    if(error) {setMutationError(error.message);return;}
    setMutationError(null);
    if (!error) setInventory((prev) => prev.filter((i) => i.id !== id));
  }

  async function createInvoiceFromContract(contract: Contract) {
    const yearCount = documents.filter((d) => d.doc_type === "invoice" && new Date(d.issued_at).getFullYear() === new Date().getFullYear()).length;
    const number = `FAC-${new Date().getFullYear()}-${String(yearCount + 1).padStart(4, "0")}`;
    const { data, error } = await supabase
      .from("documents")
      .insert({ workspace_id: workspaceId, doc_type: "invoice", contract_id: contract.id, customer_id: contract.customer_id, number, total_ht: contract.monthly_price, total_ttc: contract.monthly_price, status: "draft" })
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

  const visibleTabs = TABS.filter((t) => !t.advancedOnly || isAdvanced);

  return (
    <div className="flex flex-col gap-5">
      {mutationError && <p role="alert" className="rounded-xl bg-red-bg p-3 text-sm text-red-fg">{mutationError}</p>}
      <div className="pf-tabs">
        {visibleTabs.map((t) => (
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

      {active === "today" && <CommandCenter data={commandCenter} onNavigate={handleCommandCenterNavigate} entityName="activité de nettoyage" />}
      {active === "operations" && <CleaningOperations interventions={interventions} sites={sites} team={teamMembers} incidents={incidents} contracts={contracts} inventory={inventory} onUpdate={updateIntervention} onNavigate={handleCommandCenterNavigate} />}
      {active === "dashboard" && <CleaningDashboard contracts={contracts} interventions={interventions} incidents={incidents} inventory={inventory} alerts={alerts} />}
      {active === "customers" && (
        <CustomersModule workspaceId={workspaceId} initial={customers} label="Clients" controlled={{ rows: customers, onCreate: createCustomer, onUpdate: updateCustomer, onRemove: removeCustomer }} />
      )}
      {active === "sites" && <SitesModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={sites} customers={customers} onCreate={createSite} onUpdate={updateSite} onRemove={removeSite} />}
      {active === "contracts" && (
        <ContractsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          rows={contracts}
          sites={sites}
          customers={customers}
          documents={documents}
          onCreate={createContract}
          onUpdate={updateContract}
          onRemove={removeContract}
          onCreateInvoice={createInvoiceFromContract}
        />
      )}
      {active === "interventions" && <InterventionsModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={interventions} contracts={contracts} sites={sites} teamMembers={teamMembers} onCreate={createIntervention} onUpdate={updateIntervention} onRemove={removeIntervention} />}
      {active === "planning" && <PlanningModule rows={interventions} sites={sites} teamMembers={teamMembers} onOpenDetail={() => setActive("interventions")} />}
      {active === "quality" && isAdvanced && <QualityModule rows={interventions} sites={sites} />}
      {active === "team" && <TeamModule label="Employés" rows={teamMembers} workloadOf={(id) => `${interventions.filter((it) => it.team_member_id === id && it.status === "planned").length} planifiée(s)`} onCreate={createTeamMember} onUpdate={updateTeamMember} onRemove={removeTeamMember} />}
      {active === "inventory" && <InventoryModule key={`${active}-${focusId}`} initialFocusId={focusId} workspaceId={workspaceId} initial={inventory} label="Matériel & Consommables" controlled={{ rows: inventory, onCreate: createInventoryItem, onUpdate: updateInventoryItem, onRemove: removeInventoryItem }} />}
      {active === "incidents" && <IncidentsModule key={`${active}-${focusId}`} initialFocusId={focusId} rows={incidents} sites={sites} onCreate={createIncident} onUpdate={updateIncident} onRemove={removeIncident} />}
      {active === "quotes" && (
        <DocumentsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          docType="quote"
          rows={documents}
          itemsByDocument={documentItems}
          customers={customers}
          resolveLinkedLabel={(d) => (d.contract_id ? contracts.find((c) => c.id === d.contract_id)?.site_name ?? "—" : "—")}
          emptyHint="Devis créés manuellement, liés à un contrat ou non."
          onSetStatus={setDocumentStatus}
          onCreate={(input) => createDocument("quote", input)}
          onDeleteDraft={deleteDraftDocument}
          onConvertToInvoice={convertQuoteToInvoice}
          linkLabel="Contrat"
          linkOptions={contracts.map((c) => ({ id: c.id, label: c.site_name }))}
        />
      )}
      {active === "invoices" && (
        <DocumentsModule key={`${active}-${focusId}`} initialFocusId={focusId}
          docType="invoice"
          rows={documents}
          itemsByDocument={documentItems}
          customers={customers}
          resolveLinkedLabel={(d) => (d.contract_id ? contracts.find((c) => c.id === d.contract_id)?.site_name ?? "—" : "—")}
          emptyHint="Créez une facture manuellement, liée à un contrat ou non."
          onSetStatus={setDocumentStatus}
          onCreate={(input) => createDocument("invoice", input)}
          onDeleteDraft={deleteDraftDocument}
          linkLabel="Contrat"
          linkOptions={contracts.map((c) => ({ id: c.id, label: c.site_name }))}
        />
      )}
    </div>
  );
}

