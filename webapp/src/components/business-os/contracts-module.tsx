"use client";

import { useState } from "react";
import type { Contract, Customer } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<Contract["status"], { text: string; cls: string }> = {
  active: { text: "Actif", cls: "bg-green-bg text-green-fg" },
  ending_soon: { text: "À renouveler", cls: "bg-amber-bg text-amber-fg" },
  ended: { text: "Terminé", cls: "bg-soft text-muted" },
};

export function ContractsModule({
  workspaceId,
  initial,
  customers,
}: {
  workspaceId: string;
  initial: Contract[];
  customers: Customer[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [siteName, setSiteName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [price, setPrice] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!siteName.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("contracts")
      .insert({
        workspace_id: workspaceId,
        site_name: siteName.trim(),
        frequency: frequency.trim(),
        monthly_price: Number(price) || 0,
        customer_id: customerId || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setSiteName("");
      setFrequency("");
      setPrice("");
      setCustomerId("");
    }
  }

  async function setStatus(id: string, status: Contract["status"]) {
    const { error } = await supabase.from("contracts").update({ status }).eq("id", id);
    if (!error) setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  async function remove(id: string) {
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Contrats de site</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Nom du site" value={siteName} onChange={(e) => setSiteName(e.target.value)} className="flex-1 min-w-[140px]" />
        <Input placeholder="Fréquence (ex. 2x/semaine)" value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-40" />
        <Input placeholder="€/mois" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-24" />
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-lg border border-line bg-soft px-2.5 py-2 text-[13px]"
        >
          <option value="">Client (optionnel)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={add} disabled={saving || !siteName.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucun contrat pour l&apos;instant.</p>}
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.site_name}</b>
              {r.frequency && <span className="text-faint"> — {r.frequency}</span>}
              {r.monthly_price > 0 && <span className="text-faint"> · {r.monthly_price} €/mois</span>}
            </span>
            <span className="flex items-center gap-2">
              <select
                value={r.status}
                onChange={(e) => setStatus(r.id, e.target.value as Contract["status"])}
                className={cn("rounded-full border-0 px-2.5 py-1 text-[10.5px] font-bold", STATUS_LABEL[r.status].cls)}
              >
                {(Object.keys(STATUS_LABEL) as Contract["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s].text}
                  </option>
                ))}
              </select>
              <button onClick={() => remove(r.id)} className="text-[11px] text-faint hover:text-red-fg">
                Supprimer
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
