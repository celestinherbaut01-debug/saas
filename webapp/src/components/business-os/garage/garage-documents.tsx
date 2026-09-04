"use client";

import type { BusinessDocument, RepairOrder, Customer } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { DOC_STATUS_LABEL, formatEUR } from "@/lib/garage";

// Réutilisable tel quel pour Agence (factures liées à un projet) et
// Nettoyage (facturation liée à un contrat) plus tard — seul le sous-titre
// "lié à" change de sens selon la verticale.
export function DocumentsModule({
  docType,
  rows,
  repairOrders,
  customers,
  onSetStatus,
}: {
  docType: "quote" | "invoice";
  rows: BusinessDocument[];
  repairOrders: RepairOrder[];
  customers: Customer[];
  onSetStatus: (doc: BusinessDocument, status: BusinessDocument["status"]) => void;
}) {
  const label = docType === "quote" ? "Devis" : "Factures";
  const docs = rows.filter((d) => d.doc_type === docType).sort((a, b) => b.issued_at.localeCompare(a.issued_at));

  function orderTitle(id: string | null) {
    return id ? repairOrders.find((r) => r.id === id)?.title ?? "—" : "—";
  }
  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  const total = docs.filter((d) => d.status !== "canceled" && d.status !== "refused").reduce((s, d) => s + d.total_ttc, 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">{label}</h2>
        {docs.length > 0 && <span className="text-[12px] font-semibold text-muted">Total : {formatEUR(total)}</span>}
      </div>
      <p className="mt-1 text-[11.5px] text-muted">
        {docType === "quote" ? "Créés depuis un ordre de réparation." : "Créées depuis un ordre de réparation, une fois la réparation prête à facturer."}
      </p>

      {docs.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={docType === "quote" ? "📄" : "🧾"} title={`Aucun${docType === "quote" ? "" : "e"} ${label.toLowerCase()}`} description="Ouvrez un ordre de réparation pour en créer un(e)." />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Numéro</Th>
                  <Th>Client</Th>
                  <Th>Lié à</Th>
                  <Th>Émis le</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Statut</Th>
                </tr>
              </Thead>
              <tbody>
                {docs.map((d) => (
                  <Tr key={d.id}>
                    <Td className="font-semibold text-ink">{d.number || "—"}</Td>
                    <Td className="text-muted">{customerName(d.customer_id)}</Td>
                    <Td className="text-muted">{orderTitle(d.repair_order_id)}</Td>
                    <Td className="text-muted">{new Date(d.issued_at).toLocaleDateString("fr-FR")}</Td>
                    <Td className="text-right font-semibold">{formatEUR(d.total_ttc)}</Td>
                    <Td>
                      <Select
                        className="h-7 text-[11px]"
                        value={d.status}
                        onChange={(e) => onSetStatus(d, e.target.value as BusinessDocument["status"])}
                      >
                        {Object.entries(DOC_STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.text}
                          </option>
                        ))}
                      </Select>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}
    </Card>
  );
}
