"use client";

import { useMemo, useState } from "react";
import type {
  Customer,
  Vehicle,
  TeamMember,
  Supplier,
  Part,
  RepairOrder,
  RepairOrderPart,
  BusinessDocument,
} from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { computeGarageAlerts, partsTotals } from "@/lib/garage";
import { CustomersModule } from "@/components/business-os/customers-module";
import { VehiclesModule } from "@/components/business-os/vehicles-module";
import { RepairOrdersModule } from "@/components/business-os/garage/garage-repair-orders";
import { WorkshopModule } from "@/components/business-os/garage/garage-workshop";
import { PlanningModule } from "@/components/business-os/garage/garage-planning";
import { PartsModule } from "@/components/business-os/garage/garage-parts";
import { StockModule } from "@/components/business-os/garage/garage-stock";
import { SuppliersModule } from "@/components/business-os/garage/garage-suppliers";
import { TechniciansModule } from "@/components/business-os/garage/garage-technicians";
import { DocumentsModule } from "@/components/business-os/garage/garage-documents";
import { HistoryModule } from "@/components/business-os/garage/garage-history";
import { AlertsModule } from "@/components/business-os/garage/garage-alerts";
import { GarageDashboard } from "@/components/business-os/garage/garage-dashboard";

type Tab =
  | "dashboard"
  | "customers"
  | "vehicles"
  | "workshop"
  | "repair_orders"
  | "planning"
  | "parts"
  | "stock"
  | "suppliers"
  | "quotes"
  | "invoices"
  | "technicians"
  | "history"
  | "alerts";

const TABS: { key: Tab; label: string; advancedOnly?: boolean }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Clients" },
  { key: "vehicles", label: "Véhicules" },
  { key: "workshop", label: "Atelier", advancedOnly: true },
  { key: "repair_orders", label: "Ordres de réparation" },
  { key: "planning", label: "Planning" },
  { key: "parts", label: "Pièces" },
  { key: "stock", label: "Stock" },
  { key: "suppliers", label: "Fournisseurs" },
  { key: "quotes", label: "Devis" },
  { key: "invoices", label: "Factures" },
  { key: "technicians", label: "Techniciens", advancedOnly: true },
  { key: "history", label: "Historique" },
  { key: "alerts", label: "Alertes" },
];

/**
 * Seul composant à posséder l'état des données du Business OS Garage. Tout
 * est lifté ici (plutôt que dans chaque onglet séparément) parce que
 * plusieurs onglets doivent voir les MÊMES données à jour en direct : une
 * pièce ajoutée dans "Pièces" doit apparaître immédiatement dans le
 * sélecteur de pièces d'un ordre de réparation, un véhicule ajouté dans
 * "Véhicules" doit être choisissable tout de suite pour un nouvel ordre,
 * etc. — sans ça, changer d'onglet perdrait ou masquerait des données
 * fraîches jusqu'au rechargement de la page.
 */
export function GarageView({
  workspaceId,
  isAdvanced,
  initialCustomers,
  initialVehicles,
  initialTechnicians,
  initialSuppliers,
  initialParts,
  initialRepairOrders,
  initialLines,
  initialDocuments,
}: {
  workspaceId: string;
  isAdvanced: boolean;
  initialCustomers: Customer[];
  initialVehicles: Vehicle[];
  initialTechnicians: TeamMember[];
  initialSuppliers: Supplier[];
  initialParts: Part[];
  initialRepairOrders: RepairOrder[];
  initialLines: RepairOrderPart[];
  initialDocuments: BusinessDocument[];
}) {
  const supabase = createClient();
  const [active, setActive] = useState<Tab>("dashboard");

  const [customers, setCustomers] = useState(initialCustomers);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [technicians, setTechnicians] = useState(initialTechnicians);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [parts, setParts] = useState(initialParts);
  const [repairOrders, setRepairOrders] = useState(initialRepairOrders);
  const [lines, setLines] = useState(initialLines);
  const [documents, setDocuments] = useState(initialDocuments);
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);

  const alerts = useMemo(
    () => computeGarageAlerts({ parts, repairOrders, documents, technicians }, isAdvanced),
    [parts, repairOrders, documents, technicians, isAdvanced],
  );

  function openOrder(id: string) {
    setActive("repair_orders");
    setOpenDetailId(id);
  }

  // --- Clients / Véhicules (composants génériques, mode contrôlé) ---
  async function createCustomer(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase
      .from("customers")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (!error && data) setCustomers((prev) => [data, ...prev]);
  }
  async function updateCustomer(id: string, patch: Partial<Customer>) {
    const { error } = await supabase.from("customers").update(patch).eq("id", id);
    if (!error) setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  async function removeCustomer(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  async function createVehicle(input: { registration: string; make: string; model: string; year: string; mileage: string; customerId: string; notes: string }) {
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        workspace_id: workspaceId,
        registration: input.registration.trim().toUpperCase(),
        make: input.make.trim(),
        model: input.model.trim(),
        year: input.year ? Number(input.year) : null,
        mileage: input.mileage ? Number(input.mileage) : null,
        customer_id: input.customerId || null,
        notes: input.notes.trim(),
      })
      .select("*")
      .single();
    if (!error && data) setVehicles((prev) => [data, ...prev]);
  }
  async function updateVehicle(id: string, patch: Partial<Vehicle>) {
    const { error } = await supabase.from("vehicles").update(patch).eq("id", id);
    if (!error) setVehicles((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }
  async function removeVehicle(id: string) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (!error) setVehicles((prev) => prev.filter((v) => v.id !== id));
  }

  // --- Fournisseurs ---
  async function createSupplier(input: { name: string; phone: string; email: string; notes: string }) {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null, notes: input.notes.trim() })
      .select("*")
      .single();
    if (!error && data) setSuppliers((prev) => [data, ...prev]);
  }
  async function updateSupplier(id: string, patch: Partial<Supplier>) {
    const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
    if (!error) setSuppliers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function removeSupplier(id: string) {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (!error) setSuppliers((prev) => prev.filter((s) => s.id !== id));
  }

  // --- Pièces / Stock ---
  async function createPart(input: { name: string; reference: string; supplierId: string; unitCost: string; unitPrice: string; quantity: string; lowStockThreshold: string }) {
    const { data, error } = await supabase
      .from("parts")
      .insert({
        workspace_id: workspaceId,
        name: input.name.trim(),
        reference: input.reference.trim(),
        supplier_id: input.supplierId || null,
        unit_cost: Number(input.unitCost) || 0,
        unit_price: Number(input.unitPrice) || 0,
        quantity: Number(input.quantity) || 0,
        low_stock_threshold: input.lowStockThreshold ? Number(input.lowStockThreshold) : null,
      })
      .select("*")
      .single();
    if (!error && data) setParts((prev) => [data, ...prev]);
  }
  async function updatePart(id: string, patch: Partial<Part>) {
    const { error } = await supabase.from("parts").update(patch).eq("id", id);
    if (!error) setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  async function removePart(id: string) {
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (!error) setParts((prev) => prev.filter((p) => p.id !== id));
  }
  async function adjustPartQuantity(id: string, delta: number) {
    const part = parts.find((p) => p.id === id);
    if (!part) return;
    const quantity = Math.max(0, part.quantity + delta);
    await updatePart(id, { quantity });
  }

  // --- Techniciens ---
  async function createTechnician(input: { name: string; role: string; phone: string; email: string }): Promise<string | null> {
    const { data, error } = await supabase
      .from("team_members")
      .insert({ workspace_id: workspaceId, name: input.name.trim(), role: input.role.trim(), phone: input.phone.trim() || null, email: input.email.trim() || null })
      .select("*")
      .single();
    if (!error && data) {
      setTechnicians((prev) => [...prev, data]);
      return data.id;
    }
    return null;
  }
  async function updateTechnician(id: string, patch: Partial<TeamMember>) {
    const { error } = await supabase.from("team_members").update(patch).eq("id", id);
    if (!error) setTechnicians((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function removeTechnician(id: string) {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (!error) setTechnicians((prev) => prev.filter((t) => t.id !== id));
  }

  // --- Ordres de réparation ---
  async function createOrder(input: { title: string; vehicleId: string; scheduledAt: string }) {
    const vehicle = input.vehicleId ? vehicles.find((v) => v.id === input.vehicleId) ?? null : null;
    const { data, error } = await supabase
      .from("repair_orders")
      .insert({
        workspace_id: workspaceId,
        title: input.title.trim(),
        vehicle_id: input.vehicleId || null,
        customer_id: vehicle?.customer_id ?? null,
        scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
      })
      .select("*")
      .single();
    if (!error && data) {
      setRepairOrders((prev) => [data, ...prev]);
      setOpenDetailId(data.id);
    }
  }

  async function patchOrder(id: string, patch: Partial<RepairOrder>) {
    const { error } = await supabase.from("repair_orders").update(patch).eq("id", id);
    if (!error) setRepairOrders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function setOrderStatus(order: RepairOrder, status: RepairOrder["status"]) {
    const patch: Partial<RepairOrder> = { status };
    if (status === "done" && !order.completed_at) patch.completed_at = new Date().toISOString();
    if (status === "delivered" && !order.delivered_at) patch.delivered_at = new Date().toISOString();
    await patchOrder(order.id, patch);
  }

  async function removeOrder(id: string) {
    const { error } = await supabase.from("repair_orders").delete().eq("id", id);
    if (!error) {
      setRepairOrders((prev) => prev.filter((r) => r.id !== id));
      setOpenDetailId((cur) => (cur === id ? null : cur));
    }
  }

  async function addLine(orderId: string, input: { partId: string; partName: string; quantity: number; unitCost: number; unitPrice: number }) {
    const { data, error } = await supabase
      .from("repair_order_parts")
      .insert({
        workspace_id: workspaceId,
        repair_order_id: orderId,
        part_id: input.partId || null,
        part_name: input.partName.trim(),
        quantity: input.quantity,
        unit_cost: input.unitCost,
        unit_price: input.unitPrice,
      })
      .select("*")
      .single();
    if (error || !data) return;
    setLines((prev) => [...prev, data]);

    if (input.partId) {
      const part = parts.find((p) => p.id === input.partId);
      if (part) await adjustPartQuantity(part.id, -input.quantity);
    }

    const newLines = [...lines, data].filter((l) => l.repair_order_id === orderId);
    await patchOrder(orderId, { parts_cost: partsTotals(newLines).cost });
  }

  async function removeLine(line: RepairOrderPart) {
    const { error } = await supabase.from("repair_order_parts").delete().eq("id", line.id);
    if (error) return;
    setLines((prev) => prev.filter((l) => l.id !== line.id));

    if (line.part_id) await adjustPartQuantity(line.part_id, line.quantity);

    const remaining = lines.filter((l) => l.repair_order_id === line.repair_order_id && l.id !== line.id);
    await patchOrder(line.repair_order_id, { parts_cost: partsTotals(remaining).cost });
  }

  async function createDocument(order: RepairOrder, docType: BusinessDocument["doc_type"]) {
    const orderLines = lines.filter((l) => l.repair_order_id === order.id);
    const partsPrice = partsTotals(orderLines).price;
    const total = order.labor_cost + partsPrice;
    const yearCount = documents.filter((d) => d.doc_type === docType && new Date(d.issued_at).getFullYear() === new Date().getFullYear()).length;
    const prefix = docType === "quote" ? "DEV" : "FAC";
    const number = `${prefix}-${new Date().getFullYear()}-${String(yearCount + 1).padStart(4, "0")}`;

    const { data, error } = await supabase
      .from("documents")
      .insert({ workspace_id: workspaceId, doc_type: docType, repair_order_id: order.id, customer_id: order.customer_id, number, total_ht: total, total_ttc: total, status: "draft" })
      .select("*")
      .single();
    if (!error && data) setDocuments((prev) => [data, ...prev]);
  }

  async function setDocumentStatus(doc: BusinessDocument, status: BusinessDocument["status"]) {
    const patch: Partial<BusinessDocument> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error } = await supabase.from("documents").update(patch).eq("id", doc.id);
    if (error) return;
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...patch } : d)));
    if (doc.doc_type === "quote" && status === "accepted" && doc.repair_order_id) {
      const order = repairOrders.find((r) => r.id === doc.repair_order_id);
      if (order && (order.status === "diagnostic" || order.status === "quote")) await setOrderStatus(order, "accepted");
    }
  }

  const visibleTabs = TABS.filter((t) => !t.advancedOnly || isAdvanced);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5 border-b border-line pb-1">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={cn(
              "rounded-t-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
              active === t.key ? "bg-panel text-ink shadow-[0_1px_0_0_var(--panel)]" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "dashboard" && (
        <GarageDashboard repairOrders={repairOrders} vehicles={vehicles} customers={customers} parts={parts} documents={documents} alerts={alerts} onOpenDetail={openOrder} />
      )}
      {active === "customers" && (
        <CustomersModule
          workspaceId={workspaceId}
          initial={customers}
          label="Clients"
          controlled={{ rows: customers, onCreate: createCustomer, onUpdate: updateCustomer, onRemove: removeCustomer }}
        />
      )}
      {active === "vehicles" && (
        <VehiclesModule
          workspaceId={workspaceId}
          initial={vehicles}
          customers={customers}
          repairOrders={repairOrders}
          controlled={{ rows: vehicles, onCreate: createVehicle, onUpdate: updateVehicle, onRemove: removeVehicle }}
        />
      )}
      {active === "workshop" && isAdvanced && (
        <WorkshopModule rows={repairOrders} vehicles={vehicles} customers={customers} technicians={technicians} onAdvance={(o, s) => setOrderStatus(o, s)} onOpenDetail={openOrder} />
      )}
      {active === "repair_orders" && (
        <RepairOrdersModule
          rows={repairOrders}
          vehicles={vehicles}
          customers={customers}
          technicians={technicians}
          parts={parts}
          lines={lines}
          documents={documents}
          canManageTechnicians={isAdvanced}
          onCreate={createOrder}
          onPatch={patchOrder}
          onSetStatus={setOrderStatus}
          onRemove={removeOrder}
          onAddTechnician={(name) => createTechnician({ name, role: "Technicien", phone: "", email: "" })}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onCreateDocument={createDocument}
          onSetDocumentStatus={setDocumentStatus}
          openDetailId={openDetailId}
          onOpenDetailIdChange={setOpenDetailId}
        />
      )}
      {active === "planning" && <PlanningModule rows={repairOrders} vehicles={vehicles} customers={customers} onOpenDetail={openOrder} />}
      {active === "parts" && <PartsModule rows={parts} suppliers={suppliers} onCreate={createPart} onUpdate={updatePart} onRemove={removePart} />}
      {active === "stock" && <StockModule rows={parts} onAdjust={adjustPartQuantity} />}
      {active === "suppliers" && <SuppliersModule rows={suppliers} onCreate={createSupplier} onUpdate={updateSupplier} onRemove={removeSupplier} />}
      {active === "quotes" && <DocumentsModule docType="quote" rows={documents} repairOrders={repairOrders} customers={customers} onSetStatus={setDocumentStatus} />}
      {active === "invoices" && <DocumentsModule docType="invoice" rows={documents} repairOrders={repairOrders} customers={customers} onSetStatus={setDocumentStatus} />}
      {active === "technicians" && isAdvanced && (
        <TechniciansModule rows={technicians} repairOrders={repairOrders} onCreate={(input) => createTechnician(input)} onUpdate={updateTechnician} onRemove={removeTechnician} />
      )}
      {active === "history" && <HistoryModule rows={repairOrders} vehicles={vehicles} customers={customers} lines={lines} onOpenDetail={openOrder} />}
      {active === "alerts" && <AlertsModule alerts={alerts} advanced={isAdvanced} />}
    </div>
  );
}
