"use client";

import { useMemo, useState } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

/** Sélecteur simple d'UN métier (le métier propre du workspace). */
export function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: BusinessCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const children = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories]);
  const selected = children.find((c) => c.id === value) ?? null;

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return children
      .filter((c) => normalize(`${c.name} ${c.keywords.join(" ")}`).includes(q))
      .slice(0, 8);
  }, [children, query]);

  if (selected) {
    return (
      <button
        type="button"
        onClick={() => onChange(null)}
        className="flex w-fit items-center gap-2 rounded-lg border border-ink bg-ink px-3 py-2 text-[13px] font-semibold text-bg"
      >
        {selected.icon} {selected.name} <span className="text-bg/60">✕</span>
      </button>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Ex. garage multimarque, digitopuncture, agence web…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-soft"
                onClick={() => {
                  onChange(c.id);
                  setQuery("");
                }}
              >
                {c.icon} {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
