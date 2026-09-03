// Pipeline CRM canonique — source unique utilisée par la vue CRM, la fiche
// prospect et les outils NOVA, pour ne jamais avoir deux listes de statuts
// qui divergent.

export type ProspectStatus =
  | "new"
  | "to_contact"
  | "contacted"
  | "replied"
  | "interested"
  | "rdv"
  | "quote"
  | "won"
  | "lost"
  | "do_not_contact";

export const STATUS_OPTIONS: [ProspectStatus, string][] = [
  ["new", "Nouveau"],
  ["to_contact", "À contacter"],
  ["contacted", "Contacté"],
  ["replied", "A répondu"],
  ["interested", "Intéressé"],
  ["rdv", "RDV"],
  ["quote", "Devis"],
  ["won", "Client"],
  ["lost", "Perdu"],
  ["do_not_contact", "Ne plus contacter"],
];

export const STATUS_LABEL: Record<ProspectStatus, string> = Object.fromEntries(STATUS_OPTIONS) as Record<
  ProspectStatus,
  string
>;

export function isValidProspectStatus(value: string): value is ProspectStatus {
  return STATUS_OPTIONS.some(([v]) => v === value);
}
