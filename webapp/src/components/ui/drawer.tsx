"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Panneau latéral pour créer/éditer/consulter le détail d'une ligne — pensé
 * pour remplacer les formulaires "un input après l'autre" collés en haut
 * d'une liste. Pas de portail/librairie externe : un simple overlay fixe,
 * suffisant pour un panneau applicatif (pas une modale imbriquée).
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const panelRef=useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous=document.activeElement as HTMLElement|null;
    const panel=panelRef.current;
    panel?.focus();
    function onKey(e: KeyboardEvent) {
      if(e.key==="Tab" && panel) {
        const nodes=Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'));
        const first=nodes[0],last=nodes[nodes.length-1];
        if(!first){e.preventDefault();return;}
        if(e.shiftKey && (document.activeElement===first||document.activeElement===panel)){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
      }
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {document.removeEventListener("keydown", onKey);previous?.focus();};
  }, [open, onClose]);

  if (!open) return null;

  const widthCls = width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className={cn(
          "relative flex h-full w-full flex-col overflow-y-auto border-l border-line bg-panel shadow-2xl",
          widthCls,
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-panel px-5 py-4">
          <div>
            <h2 className="font-display text-[15px] font-extrabold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-soft hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-line bg-panel px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
