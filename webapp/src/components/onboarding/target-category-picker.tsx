"use client";

import { useMemo, useState } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  const parents = useMemo(
    () => categories.filter((c) => c.parent_id === null).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const children = useMemo(
    () => categories.filter((c) => c.parent_id !== null),
    [categories],
  );

  const filteredChildren = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return children;
    return children.filter((c) => {
      const haystack = normalize(`${c.name} ${c.keywords.join(" ")}`);
      return haystack.includes(q);
    });
  }, [children, query]);

  const byParent = useMemo(() => {
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
  function toggleGroup(parentId: string, ids: string[]) {
    const allOn = ids.every((id) => selected.has(id));
    onChange(
      allOn
        ? value.filter((v) => !ids.includes(v))
        : Array.from(new Set([...value, ...ids])),
    );
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

  return (
    <div className="flex flex-col gap-3">
      {recommended.length > 0 && (
        <div className="rounded-xl border border-line bg-soft p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-muted">
              Recommandé pour votre offre : {recommended.map((c) => c.name).join(", ")}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={selectRecommended}>
              Tout sélectionner
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Rechercher un métier : garage, digitopuncture, coiffeur…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Tout le catalogue
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
          Tout désélectionner
        </Button>
      </div>

      <p className="text-[12px] text-muted">{value.length} métier(s) sélectionné(s)</p>

      <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
        {parents.map((parent) => {
          const items = byParent.get(parent.id) ?? [];
          if (items.length === 0) return null;
          const ids = items.map((c) => c.id);
          const allOn = ids.every((id) => selected.has(id));
          return (
            <div key={parent.id} className="border-b border-line last:border-0">
              <div className="flex items-center justify-between bg-soft px-3 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-faint">
                  {parent.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleGroup(parent.id, ids)}
                  className="text-[11px] font-semibold text-accent"
                >
                  {allOn ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3">
                {items.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-[12px]",
                      selected.has(c.id)
                        ? "border-ink bg-ink text-bg"
                        : "border-line bg-panel text-ink hover:bg-soft",
                    )}
                  >
                    <span>{c.icon}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {filteredChildren.length === 0 && (
          <p className="p-4 text-[13px] text-muted">Aucun métier ne correspond à &laquo;&nbsp;{query}&nbsp;&raquo;.</p>
        )}
      </div>
    </div>
  );
}
