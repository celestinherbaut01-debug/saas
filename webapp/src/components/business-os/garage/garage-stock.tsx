"use client";

import type { Part } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Même table que Pièces (parts), vue différente : focalisée sur les
// niveaux de stock et l'ajustement rapide, pas le catalogue/prix.
export function StockModule({ rows, onAdjust }: { rows: Part[]; onAdjust: (id: string, delta: number) => void }) {
  const sorted = [...rows].sort((a, b) => {
    const aLow = a.low_stock_threshold != null && a.quantity <= a.low_stock_threshold;
    const bLow = b.low_stock_threshold != null && b.quantity <= b.low_stock_threshold;
    if (aLow !== bLow) return aLow ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Stock</h2>
      <p className="mt-1 text-[11.5px] text-muted">Même catalogue que l&apos;onglet Pièces — vue focalisée sur les quantités.</p>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📦" title="Aucune pièce en stock" description="Ajoutez des pièces depuis l'onglet Pièces." />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Pièce</Th>
                  <Th className="text-right">Quantité</Th>
                  <Th className="text-right">Seuil bas</Th>
                  <Th className="text-right">Ajuster</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((p) => {
                  const low = p.low_stock_threshold != null && p.quantity <= p.low_stock_threshold;
                  return (
                    <Tr key={p.id}>
                      <Td className="font-semibold text-ink">
                        {p.name} {low && <Badge tone="danger" className="ml-1.5">Stock bas</Badge>}
                      </Td>
                      <Td className={cn("text-right font-display font-bold", low && "text-red-fg")}>
                        {p.quantity} {p.unit}
                      </Td>
                      <Td className="text-right text-muted">{p.low_stock_threshold ?? "—"}</Td>
                      <Td className="text-right">
                        <span className="inline-flex items-center gap-1.5">
                          <button onClick={() => onAdjust(p.id, -1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                            −
                          </button>
                          <button onClick={() => onAdjust(p.id, 1)} className="h-6 w-6 rounded-md border border-line bg-panel">
                            +
                          </button>
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      )}
    </Card>
  );
}
