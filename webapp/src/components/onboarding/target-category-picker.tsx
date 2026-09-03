"use client";

import { useMemo, useState } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function normalize(s: string) {
  return s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

export function TargetCategoryPicker({
  categories,
  value,
  onChange,
  recommendedSlugs,
}: {
  categories: BusinessCategory[];
  value: string[];
  onChange: (ids: string[]) => void;
  recommendedSlugs?: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeParentId, setActiveParentId] = useState<string | null>(null);

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const children = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories]);

  const byParentAll = useMemo(() => {
    const map = new Map<string, BusinessCategory[]>();
    for (const c of children) {
      const key = c.parent_id!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [children]);

  const isSearching = query.trim().length > 0;

  const filteredChildren = useMemo(() => {
    if (!isSearching) return [];
    const q = normalize(query.trim());
    return children.filter((c) => normalize(`${c.name} ${c.keywords.join(" ")}`).includes(q));
  }, [children, query, isSearching]);

  const byParentFiltered = useMemo(() => {
    const map = new Map<string, BusinessCategory[]>();
    for (const c of filteredChildren) {
      const key = c.parent_id!;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [filteredChildren]);

  const recommended = useMemo(
    () => children.filter((c) => recommendedSlugs?.includes(c.slug)),
    [children, recommendedSlugs],
  );

  const selected = new Set(value);
  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
  function selectRecommended() {
    onChange(Array.from(new Set([...value, ...recommended.map((c) => c.id)])));
  }
  function selectAll() {
    onChange(children.map((c) => c.id));
  }
  function clearAll() {
    onChange([]);
  }

  const activeParent = activeParentId ? parents.find((p) => p.id === activeParentId) ?? null : null;
  const activeChildren = activeParentId ? byParentAll.get(activeParentId) ?? [] : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-[17px] font-extrabold tracking-tight text-ink">
          Qui souhaitez-vous prospecter ?
        </h2>
        <p className="mt-1 text-[13.5px] text-muted">
          Sélectionnez les types d&apos;entreprises que vous souhaitez cibler.
        </p>
      </div>

      {recommended.length > 0 && (
        <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-4">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-accent">
            Recommandé pour votre activité
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">
            {recommended.map((c) => c.name).join(" · ")}
          </p>
          <button
            type="button"
            onClick={selectRecommended}
            className="mt-3 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            Sélectionner les recommandations
          </button>
        </div>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-faint">
          🔍
        </span>
        <Input
          className="pl-10"
          placeholder="Rechercher un métier ou un secteur…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink">
          {value.length === 0
            ? "Aucun métier sélectionné"
            : `${value.length} métier${value.length > 1 ? "s" : ""} sélectionné${value.length > 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAll} className="text-[12px] font-semibold text-accent hover:underline">
            Tout sélectionner
          </button>
          <button type="button" onClick={clearAll} className="text-[12px] font-semibold text-faint hover:text-muted hover:underline">
            Tout désélectionner
          </button>
        </div>
      </div>

      {isSearching ? (
        <div className="flex max-h-[360px] flex-col gap-5 overflow-y-auto pr-1">
          {parents.map((parent) => {
            const items = byParentFiltered.get(parent.id) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={parent.id}>
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-faint">{parent.name}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((c) => (
                    <Chip key={c.id} label={c.name} icon={c.icon} selected={selected.has(c.id)} onClick={() => toggle(c.id)} />
                  ))}
                </div>
              </div>
            );
          })}
          {filteredChildren.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted">
              Aucun métier ne correspond à &laquo;&nbsp;{query}&nbsp;&raquo;.
            </p>
          )}
        </div>
      ) : activeParent ? (
        <div>
          <button
            type="button"
            onClick={() => setActiveParentId(null)}
            className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline"
          >
            ← Toutes les catégories
          </button>
          <p className="mb-2.5 font-display text-[13.5px] font-bold text-ink">{activeParent.name}</p>
          <div className="flex max-h-[320px] flex-wrap content-start gap-2 overflow-y-auto pr-1">
            {activeChildren.map((c) => (
              <Chip key={c.id} label={c.name} icon={c.icon} selected={selected.has(c.id)} onClick={() => toggle(c.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {parents.map((parent) => {
            const items = byParentAll.get(parent.id) ?? [];
            if (items.length === 0) return null;
            const countSelected = items.filter((c) => selected.has(c.id)).length;
            return (
              <button
                key={parent.id}
                type="button"
                onClick={() => setActiveParentId(parent.id)}
                className={cn(
                  "group flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition",
                  countSelected > 0
                    ? "border-accent/40 bg-accent/[0.05]"
                    : "border-line bg-panel hover:border-ink/25 hover:bg-soft",
                )}
              >
                <span className="font-display text-[13.5px] font-bold text-ink">{parent.name}</span>
                <span className="text-[11px] text-faint">
                  {items.length} métier{items.length > 1 ? "s" : ""}
                  {countSelected > 0 && (
                    <span className="font-semibold text-accent"> · {countSelected} sélectionné{countSelected > 1 ? "s" : ""}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition",
        selected
          ? "border-ink bg-ink text-bg shadow-sm"
          : "border-line bg-panel text-ink hover:border-ink/30 hover:bg-soft",
      )}
    >
      {icon && <span className="text-[13px] leading-none">{icon}</span>}
      <span>{label}</span>
      {selected && <span className="text-[11px] leading-none">✓</span>}
    </button>
  );
}
