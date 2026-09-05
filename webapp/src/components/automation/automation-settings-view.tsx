"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { updateAutomationSettings } from "@/lib/actions/automation";
import type { AutomationSettings } from "@/lib/session";
import type { BusinessOsVertical } from "@/lib/business-os";
import { cn } from "@/lib/utils";

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "border border-line bg-soft",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

const APPOINTMENT_COPY: Record<BusinessOsVertical, { title: string; desc: string }> = {
  garage: { title: "Rappels de rendez-vous atelier", desc: "NOVA vous signale les véhicules attendus bientôt en atelier." },
  cleaning: { title: "Rappels d'interventions", desc: "NOVA vous signale les interventions planifiées bientôt." },
  restaurant: { title: "Rappels de rendez-vous", desc: "NOVA vous signale les rendez-vous à venir." },
  agency: { title: "Rappels de rendez-vous", desc: "NOVA vous signale les rendez-vous à venir." },
  generic: { title: "Rappels de rendez-vous", desc: "NOVA vous signale les rendez-vous à venir." },
};

export function AutomationSettingsView({
  workspaceId,
  initialSettings,
  vertical,
}: {
  workspaceId: string;
  initialSettings: AutomationSettings;
  vertical: BusinessOsVertical;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [customEnabled, setCustomEnabled] = useState(initialSettings.custom_reminder_hours_before != null);
  const [customHours, setCustomHours] = useState(initialSettings.custom_reminder_hours_before ?? 48);

  function save(patch: Partial<AutomationSettings>) {
    setSettings((prev) => ({ ...prev, ...patch }));
    setToast(null);
    startTransition(async () => {
      const result = await updateAutomationSettings(workspaceId, patch);
      if (!result.ok) setToast({ kind: "err", text: result.error ?? "Échec de l'enregistrement." });
    });
  }

  // L'agence n'a ni "rendez-vous" ni stock au sens propre — son automation
  // naturelle, ce sont les renouvellements de domaines/hébergements.
  const hasAppointments = vertical !== "agency";
  const hasLowStock = vertical !== "agency";
  const hasRenewal = vertical === "agency";
  const appointmentCopy = APPOINTMENT_COPY[vertical];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Automatisations</h1>
        <p className="mt-1 text-[13px] text-muted">
          Configurez ce que NOVA doit surveiller pour vous. L&apos;envoi automatique (SMS/email) n&apos;est pas
          encore branché — ces réglages pilotent les insights proactifs affichés dans votre Business OS.
        </p>
      </div>

      {toast && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium",
            toast.kind === "ok" ? "bg-green-bg text-green-fg" : "bg-red-bg text-red-fg",
          )}
        >
          {toast.text}
        </p>
      )}

      {hasAppointments && (
        <Card>
          <h2 className="text-[13px] font-bold text-ink">{appointmentCopy.title}</h2>
          <p className="mt-1 text-[12px] text-muted">{appointmentCopy.desc}</p>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink">24h avant</span>
              <Toggle checked={settings.appointment_reminder_24h} disabled={pending} onChange={(v) => save({ appointment_reminder_24h: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-ink">2h avant</span>
              <Toggle checked={settings.appointment_reminder_2h} disabled={pending} onChange={(v) => save({ appointment_reminder_2h: v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-ink">Personnalisé</span>
                {customEnabled && (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={customHours}
                      disabled={pending}
                      onChange={(e) => setCustomHours(Math.max(1, Number(e.target.value) || 1))}
                      onBlur={() => save({ custom_reminder_hours_before: customHours })}
                      className="w-16 rounded-md border border-line bg-soft px-2 py-1 text-[12.5px] text-ink"
                    />
                    <span className="text-[11.5px] text-faint">heures avant</span>
                  </>
                )}
              </div>
              <Toggle
                checked={customEnabled}
                disabled={pending}
                onChange={(v) => {
                  setCustomEnabled(v);
                  save({ custom_reminder_hours_before: v ? customHours : null });
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {hasLowStock && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-bold text-ink">Alerte stock bas</h2>
              <p className="mt-1 text-[12px] text-muted">NOVA vous signale les articles sous leur seuil de stock.</p>
            </div>
            <Toggle checked={settings.low_stock_alert} disabled={pending} onChange={(v) => save({ low_stock_alert: v })} />
          </div>
        </Card>
      )}

      {hasRenewal && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-bold text-ink">Alerte renouvellement</h2>
              <p className="mt-1 text-[12px] text-muted">NOVA vous signale les domaines/hébergements qui expirent bientôt.</p>
            </div>
            <Toggle checked={settings.renewal_alert} disabled={pending} onChange={(v) => save({ renewal_alert: v })} />
          </div>
        </Card>
      )}

      <p className="text-[11px] text-faint">
        Ces rappels alimentent les insights NOVA dans votre{" "}
        <a href="/business-os" className="font-semibold text-accent">
          Business OS
        </a>
        . Aucun SMS ni email n&apos;est envoyé automatiquement pour l&apos;instant.
      </p>
    </div>
  );
}
