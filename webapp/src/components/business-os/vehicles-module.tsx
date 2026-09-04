"use client";

import { useState } from "react";
import type { Vehicle, Customer } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function VehiclesModule({
  workspaceId,
  initial,
  customers,
}: {
  workspaceId: string;
  initial: Vehicle[];
  customers: Customer[];
}) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [registration, setRegistration] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [mileage, setMileage] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!registration.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        workspace_id: workspaceId,
        registration: registration.trim().toUpperCase(),
        make: make.trim(),
        model: model.trim(),
        mileage: mileage ? Number(mileage) : null,
        customer_id: customerId || null,
      })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setRegistration("");
      setMake("");
      setModel("");
      setMileage("");
      setCustomerId("");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function customerName(id: string | null) {
    return id ? customers.find((c) => c.id === id)?.name ?? "—" : "—";
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Véhicules</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input placeholder="Immatriculation" value={registration} onChange={(e) => setRegistration(e.target.value)} className="w-32" />
        <Input placeholder="Marque" value={make} onChange={(e) => setMake(e.target.value)} className="w-28" />
        <Input placeholder="Modèle" value={model} onChange={(e) => setModel(e.target.value)} className="w-28" />
        <Input placeholder="Km" type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} className="w-24" />
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-lg border border-line bg-soft px-2.5 py-2 text-[13px]"
        >
          <option value="">Propriétaire (optionnel)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={add} disabled={saving || !registration.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucun véhicule pour l&apos;instant.</p>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.registration}</b> — {r.make} {r.model}
              {r.mileage != null && <span className="text-faint"> · {r.mileage.toLocaleString("fr-FR")} km</span>}
              <span className="text-faint"> · {customerName(r.customer_id)}</span>
            </span>
            <button onClick={() => remove(r.id)} className="text-[11px] text-faint hover:text-red-fg">
              Supprimer
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
