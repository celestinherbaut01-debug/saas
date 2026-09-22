/** Étiquette de section premium (ex. "OBJECTIF BUSINESS TWIN", "KPI RÉELS") — jamais un simple <h2> nu : un logiciel pro nomme ses blocs. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-0.5 text-[10.5px] font-bold uppercase tracking-wider text-faint">{children}</p>;
}
