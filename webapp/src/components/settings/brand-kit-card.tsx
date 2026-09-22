"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveBrandKit } from "@/lib/actions/studio";
import type { BrandKit, BrandTone } from "@/lib/studio/types";

const TONE_OPTIONS: { value: BrandTone; label: string }[] = [
  { value: "professionnel", label: "Professionnel" },
  { value: "chaleureux", label: "Chaleureux" },
  { value: "dynamique", label: "Dynamique" },
  { value: "premium", label: "Premium" },
];

/**
 * Réutilisé automatiquement par Studio IA (lib/studio/generator.ts) pour
 * chaque contenu généré — jamais redemandé création par création.
 */
export function BrandKitCard({ workspaceId, initialBrandKit }: { workspaceId: string; initialBrandKit: BrandKit }) {
  const [kit, setKit] = useState<BrandKit>(initialBrandKit);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function save() {
    setStatus("idle");
    startTransition(async () => {
      const result = await saveBrandKit(workspaceId, kit);
      setStatus(result.ok ? "saved" : "error");
    });
  }

  return (
    <Card>
      <h2 className="font-display text-sm font-bold">Brand Kit</h2>
      <p className="mt-1 text-[12.5px] text-muted">
        Le ton et les couleurs sont appliqués automatiquement à chaque contenu créé dans Studio IA.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="brand-tone">Ton</Label>
          <Select id="brand-tone" value={kit.tone} onChange={(e) => setKit({ ...kit, tone: e.target.value as BrandTone })} className="mt-1 w-full">
            {TONE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="brand-primary">Couleur principale</Label>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={kit.primaryColor} onChange={(e) => setKit({ ...kit, primaryColor: e.target.value })} className="h-10 w-10 shrink-0 rounded-lg border border-line" />
            <Input id="brand-primary" value={kit.primaryColor} onChange={(e) => setKit({ ...kit, primaryColor: e.target.value })} />
          </div>
        </div>
        <div>
          <Label htmlFor="brand-accent">Couleur d&apos;accent</Label>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={kit.accentColor} onChange={(e) => setKit({ ...kit, accentColor: e.target.value })} className="h-10 w-10 shrink-0 rounded-lg border border-line" />
            <Input id="brand-accent" value={kit.accentColor} onChange={(e) => setKit({ ...kit, accentColor: e.target.value })} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Label htmlFor="brand-tagline">Signature (optionnel)</Label>
        <Input
          id="brand-tagline"
          value={kit.tagline ?? ""}
          onChange={(e) => setKit({ ...kit, tagline: e.target.value || null })}
          placeholder="Ex. Votre garage de confiance depuis 1998"
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={pending} size="sm">
          {pending ? "Enregistrement…" : "Enregistrer le Brand Kit"}
        </Button>
        {status === "saved" && <span className="text-[12px] font-medium text-green-fg">Enregistré.</span>}
        {status === "error" && <span className="text-[12px] font-medium text-red-fg">Échec de l&apos;enregistrement.</span>}
      </div>
    </Card>
  );
}
