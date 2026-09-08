"use client";

import { useMemo, useState } from "react";
import type { BusinessCategory } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const normalize = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

const POPULAR_SLUGS = ["garages", "hair", "restaurants", "web", "cleaning", "realestate", "plumbing", "beauty"];

/**
 * Sélecteur d'UN métier (le métier propre du workspace) — recherche floue
 * instantanée dès la première lettre (nom + mots-clés/synonymes du
 * catalogue), quelques métiers populaires proposés avant même de taper, et
 * une sortie de secours explicite ("Je ne trouve pas mon métier") : le
 * texte libre est conservé (voir customLabel) et l'onboarding continue
 * quand même — jamais bloqué par un catalogue incomplet.
 */
export function CategoryCombobox({
  categories,
  value,
  onChange,
  customLabel,
  onCustomLabelChange,
}: {
  categories: BusinessCategory[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Intitulé libre saisi quand le métier n'est pas dans le catalogue — vide tant qu'un id est choisi. */
  customLabel?: string;
  onCustomLabelChange?: (label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const children = useMemo(() => categories.filter((c) => c.parent_id !== null), [categories]);
  const selected = children.find((c) => c.id === value) ?? null;

  const popular = useMemo(
    () => POPULAR_SLUGS.map((slug) => children.find((c) => c.slug === slug)).filter((c): c is BusinessCategory => Boolean(c)),
    [children],
  );

  const matches = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return children
      .filter((c) => normalize(`${c.name} ${c.keywords.join(" ")}`).includes(q))
      .slice(0, 8);
  }, [children, query]);

  function choose(id: string) {
    onChange(id);
    onCustomLabelChange?.("");
    setQuery("");
    setNotFoundOpen(false);
  }

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

  if (customLabel) {
    return (
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => onCustomLabelChange?.("")}
          className="flex w-fit items-center gap-2 rounded-lg border border-dashed border-line bg-panel px-3 py-2 text-[13px] font-semibold text-ink"
        >
          « {customLabel} » <span className="text-faint">✕</span>
        </button>
        <p className="text-[11px] text-faint">
          Métier non catalogué — votre espace démarre en configuration générale, ajustable à tout moment.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
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
                  onClick={() => choose(c.id)}
                >
                  {c.icon} {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!query && popular.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {popular.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c.id)}
              className="rounded-full border border-line bg-panel px-2.5 py-1 text-[12px] text-ink hover:bg-soft"
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      )}

      {!notFoundOpen ? (
        <button type="button" onClick={() => setNotFoundOpen(true)} className="self-start text-[11.5px] font-medium text-faint underline">
          Je ne trouve pas mon métier
        </button>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-soft p-2.5">
          <p className="text-[11.5px] font-semibold text-muted">Décrivez votre métier en quelques mots</p>
          <div className="flex gap-1.5">
            <Input
              value={customLabel ?? ""}
              onChange={(e) => onCustomLabelChange?.(e.target.value)}
              placeholder="Ex. digitopuncture, atelier de tapisserie d'ameublement…"
              className="flex-1"
            />
            <Button
              type="button"
              size="sm"
              disabled={!customLabel?.trim()}
              onClick={() => setNotFoundOpen(false)}
            >
              Proposer ce métier
            </Button>
          </div>
          <p className="text-[10.5px] text-faint">
            Votre inscription n&apos;est jamais bloquée par un métier absent du catalogue — votre espace démarre en
            configuration générale, et nous ajoutons ce métier au catalogue.
          </p>
        </div>
      )}
    </div>
  );
}
