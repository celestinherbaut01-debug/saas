import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `interactive` ajoute un effet de survol (légère élévation + bordure
 * accent) — réservé aux cartes réellement cliquables (ex. bibliothèque
 * Studio), jamais un simple conteneur d'information qui n'irait nulle part.
 */
export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-panel p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,transform,border-color] duration-200",
        interactive && "cursor-pointer hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-[var(--shadow-md)]",
        className,
      )}
      {...props}
    />
  );
}
