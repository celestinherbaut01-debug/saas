"use client";

import { useState } from "react";
import type { InventoryItem, InventoryMovement } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";
import { MOVEMENT_TYPE_LABEL } from "@/lib/butcher";

// Ledger pur : toute sortie manuelle de stock (perte, ajustement) passe par
// ici plutôt que par une édition directe de la quantité sur la fiche produit
// — seule façon de garder un historique réel des mouvements et des pertes.
export function MovementsModule({
  rows,
  items,
  onDeclareLoss,
  onAdjust,
}: {
  rows: InventoryMovement[];
  items: InventoryItem[];
  onDeclareLoss: (input: { itemId: string; quantity: string; reason: string }) => void;
  onAdjust: (input: { itemId: string; quantity: string; reason: string }) => void;
}) {
  const [formOpen, setFormOpen] = useState<"loss" | "adjustment" | null>(null);
  const sorted = [...rows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  function itemName(id: string) {
    return items.find((i) => i.id === id)?.name ?? "—";
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-sm font-bold">
          Mouvements de stock <span className="font-normal text-faint">({rows.length})</span>
        </h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setFormOpen("loss")}>
            Déclarer une perte
          </Button>
          <Button size="sm" variant="outline" onClick={() => setFormOpen("adjustment")}>
            Ajuster le stock
          </Button>
        </div>
      </div>

      {formOpen && (
        <MovementForm
          mode={formOpen}
          items={items}
          onClose={() => setFormOpen(null)}
          onSubmit={(input) => {
            if (formOpen === "loss") onDeclareLoss(input);
            else onAdjust(input);
            setFormOpen(null);
          }}
        />
      )}

      {sorted.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="📒" title="Aucun mouvement" description="Les réceptions, pertes et ajustements de stock apparaîtront ici." />
        </div>
      ) : (
        <div className="mt-4">
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Produit</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Quantité</Th>
                  <Th>Lot / DLC</Th>
                  <Th>Motif</Th>
                </tr>
              </Thead>
              <tbody>
                {sorted.map((m) => (
                  <Tr key={m.id}>
                    <Td className="text-muted">{new Date(m.created_at).toLocaleString("fr-FR")}</Td>
                    <Td className="font-semibold text-ink">{itemName(m.item_id)}</Td>
                    <Td>
                      <Badge tone={MOVEMENT_TYPE_LABEL[m.type].tone}>{MOVEMENT_TYPE_LABEL[m.type].text}</Badge>
                    </Td>
                    <Td className={`text-right font-semibold ${m.quantity_delta < 0 ? "text-red-fg" : "text-ink"}`}>
                      {m.quantity_delta > 0 ? "+" : ""}
                      {m.quantity_delta}
                    </Td>
                    <Td className="text-muted">
                      {m.lot_number ? `Lot ${m.lot_number}` : "—"}
                      {m.expires_on ? ` · DLC ${new Date(m.expires_on).toLocaleDateString("fr-FR")}` : ""}
                    </Td>
                    <Td className="text-muted">{m.reason || "—"}</Td>
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

function MovementForm({
  mode,
  items,
  onClose,
  onSubmit,
}: {
  mode: "loss" | "adjustment";
  items: InventoryItem[];
  onClose: () => void;
  onSubmit: (input: { itemId: string; quantity: string; reason: string }) => void;
}) {
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const item = items.find((i) => i.id === itemId);

  return (
    <div className="mt-3 rounded-xl border border-line bg-soft p-3">
      <p className="text-[12.5px] font-bold text-ink">
        {mode === "loss" ? "Déclarer une perte" : "Ajuster le stock"}
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Select value={itemId} onChange={(e) => setItemId(e.target.value)} className="sm:col-span-1">
          <option value="">Choisir un produit…</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({i.quantity} {i.unit} en stock)
            </option>
          ))}
        </Select>
        <Input
          type="number"
          step="0.01"
          placeholder={mode === "loss" ? "Quantité perdue" : "Nouvelle quantité en stock"}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Input placeholder={mode === "loss" ? "Motif (ex. casse, DLC dépassée)" : "Motif de l'ajustement"} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      {mode === "adjustment" && item && quantity && (
        <p className="mt-1.5 text-[11px] text-faint">
          Écart appliqué : {Number(quantity) - item.quantity > 0 ? "+" : ""}
          {(Number(quantity) - item.quantity).toFixed(2)} {item.unit}
        </p>
      )}
      <div className="mt-2.5 flex gap-2">
        <Button size="sm" onClick={() => onSubmit({ itemId, quantity, reason })} disabled={!itemId || !quantity}>
          Enregistrer
        </Button>
        <Button size="sm" variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
