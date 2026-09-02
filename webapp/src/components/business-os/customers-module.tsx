"use client";

import { useState } from "react";
import type { Customer } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomersModule({ workspaceId, initial, label }: { workspaceId: string; initial: Customer[]; label: string }) {
  const supabase = createClient();
  const [rows, setRows] = useState(initial);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({ workspace_id: workspaceId, name: name.trim(), phone: phone.trim() || null })
      .select("*")
      .single();
    setSaving(false);
    if (!error && data) {
      setRows((prev) => [data, ...prev]);
      setName("");
      setPhone("");
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (!error) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">{label}</h2>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Téléphone (optionnel)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button size="sm" onClick={add} disabled={saving || !name.trim()}>
          Ajouter
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {rows.length === 0 && <p className="text-[12.5px] text-muted">Aucun{label === "Clients" ? " client" : ""} pour l&apos;instant.</p>}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-soft px-3 py-2 text-[12.5px]">
            <span>
              <b>{r.name}</b> {r.phone && <span className="text-faint">— {r.phone}</span>}
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
