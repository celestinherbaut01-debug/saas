"use client";

import { useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  Globe2,
  LayoutDashboard,
  MapPin,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const EXAMPLES = {
  web: {
    label: "Agence web",
    icon: Globe2,
    title: "Vos prochains clients web",
    offer: "Création de site internet",
    description:
      "Des commerces sans site renseigné sur Google. L’absence réelle de site reste à confirmer.",
    rows: [
      {
        name: "Atelier Démo",
        activity: "Artisan · 4,2 km",
        signal: "Sans site renseigné",
        detail: "Fiche Google trouvée · site à confirmer",
        initials: "AD",
      },
      {
        name: "Salon Démo",
        activity: "Coiffure · 7,8 km",
        signal: "Sans site renseigné",
        detail: "Un contact pour proposer votre création",
        initials: "SD",
      },
      {
        name: "Boutique Démo",
        activity: "Commerce · 12,5 km",
        signal: "Sans site renseigné",
        detail: "Dans les secteurs que vous avez choisis",
        initials: "BD",
      },
    ],
  },
  cleaning: {
    label: "Nettoyage",
    icon: Building2,
    title: "Des locaux à prospecter",
    offer: "Nettoyage de bureaux",
    description:
      "Des cabinets et gestionnaires de locaux. La surface, le prestataire actuel et le besoin restent à qualifier.",
    rows: [
      {
        name: "Cabinet Démo",
        activity: "Cabinet comptable · 3,1 km",
        signal: "Secteur compatible",
        detail: "Locaux et fréquence à qualifier",
        initials: "CD",
      },
      {
        name: "Agence Démo",
        activity: "Immobilier · 6,4 km",
        signal: "Secteur compatible",
        detail: "Interlocuteur à identifier",
        initials: "AD",
      },
      {
        name: "Gestion Démo",
        activity: "Gestion de biens · 9,2 km",
        signal: "Secteur compatible",
        detail: "Contrat existant à vérifier au contact",
        initials: "GD",
      },
    ],
  },
  garage: {
    label: "Garage",
    icon: Wrench,
    title: "Une journée bien organisée",
    offer: "Mon atelier · Aujourd’hui",
    description:
      "Votre priorité : clients, véhicules et interventions. La prospection de flottes est une offre B2B distincte.",
    rows: [
      {
        name: "09:00 · Client Démo A",
        activity: "Véhicule A · Entretien",
        signal: "Rendez-vous",
        detail: "Historique et fiche véhicule au même endroit",
        initials: "09",
      },
      {
        name: "10:30 · Client Démo B",
        activity: "Véhicule B · Freinage",
        signal: "Intervention",
        detail: "Travaux à effectuer dans l’atelier",
        initials: "10",
      },
      {
        name: "14:00 · Client Démo C",
        activity: "Véhicule C · Diagnostic",
        signal: "À préparer",
        detail: "Préparer l’intervention et les pièces",
        initials: "14",
      },
    ],
  },
} as const;

export function ProductDemo() {
  const [active, setActive] = useState<keyof typeof EXAMPLES>("web");
  const [selected, setSelected] = useState<number | null>(null);
  const example = EXAMPLES[active];
  return (
    <div className="product-demo" data-testid="product-demo">
      <div className="demo-topbar">
        <div className="flex gap-1.5" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <span>Votre espace ProspectFlow</span>
        <span className="demo-example">Démonstration</span>
      </div>
      <div className="demo-layout">
        <aside className="demo-sidebar" aria-hidden="true">
          <span className="demo-monogram">
            pf<span>•</span>
          </span>
          <LayoutDashboard size={17} />
          <span className="demo-nav-active">
            <Search size={17} />
          </span>
          <CalendarDays size={17} />
          <Sparkles size={17} />
          <span className="demo-avatar">CH</span>
        </aside>
        <div className="demo-content">
          <div
            className="demo-personas"
            aria-label="Choisissez un métier pour la démonstration"
          >
            {(Object.keys(EXAMPLES) as (keyof typeof EXAMPLES)[]).map((key) => {
              const Icon = EXAMPLES[key].icon;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active === key}
                  onClick={() => {
                    setActive(key);
                    setSelected(null);
                  }}
                  className={cn(active === key && "is-active")}
                >
                  <Icon size={13} />
                  {EXAMPLES[key].label}
                </button>
              );
            })}
          </div>
          <div className="demo-heading">
            <p>
              {active === "garage" ? "GESTION MÉTIER" : "PROSPECTION CIBLÉE"}
            </p>
            <h3>{example.title}</h3>
          </div>
          <div className="demo-query">
            <Search size={15} />
            <span>{example.offer}</span>
            {active !== "garage" && (
              <span className="demo-radius">
                <MapPin size={12} />
                20 km
              </span>
            )}
          </div>
          <div className="demo-list">
            {example.rows.map((row, i) => (
              <button
                key={row.name}
                type="button"
                onClick={() => setSelected(selected === i ? null : i)}
                aria-expanded={selected === i}
                className={cn("demo-row", selected === i && "is-selected")}
              >
                <span className="demo-initials">{row.initials}</span>
                <span className="min-w-0 flex-1">
                  <strong>{row.name}</strong>
                  <small>{row.activity}</small>
                  {selected === i && (
                    <span className="demo-row-detail">{row.detail}</span>
                  )}
                </span>
                <span className="demo-signal">
                  <Check size={10} />
                  {row.signal}
                </span>
                <ChevronRight size={13} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
          <div className="demo-insight">
            <Sparkles size={15} className="shrink-0" />
            <p>{example.description}</p>
          </div>
          <div className="demo-bottom">
            <span>Exemples fictifs · aucune recherche réelle</span>
            <ArrowRight size={13} />
          </div>
        </div>
      </div>
    </div>
  );
}
