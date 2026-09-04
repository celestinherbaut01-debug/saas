"use client";

import type { BusinessDocument, Customer } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { DOC_STATUS_LABEL } from "@/lib/garage";
import { formatEUR } from "@/lib/format";

// Partagé entre Garage (lié à un ordre de réparation), Nettoyage (lié à un
// contrat) et Agence (lié à un projet) — `resolveLinkedLabel` isole la
// seule chose qui change entre verticales : le nom de ce à quoi le
// devis/la facture est rattaché.
export function DocumentsModule({
  docType,
  rows,
  customers,
  resolveLinkedLabel,
  emptyHint,
  onSetStatus,
}: {
  docType: "quote" | "invoice";
  rows: BusinessDocument[];
  customers: Customer[];
  resolveLinkedLabel: (doc: BusinessDocument) => string;
  emptyHint: string;
  onSetStatus: (doc: BusinessDocument, status: BusinessDocument["status"]) => void;
}) {
  const label = docType === "quote" ? "Devis" : "Factures";
  const docs = rows.filter((d) => d.doc_type === docType).sort((a, b) => b.issued_at.localeCompare(a.issued_at));

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
      <p className="mt-1 text-[11.5px] text-muted">{emptyHint}</p>

      {docs.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={docType === "quote" ? "📄" : "🧾"} title={`Aucun${docType === "quote" ? "" : "e"} ${label.toLowerCase()}`} description={emptyHint} />
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
                    <Td className="text-muted">{resolveLinkedLabel(d)}</Td>
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
