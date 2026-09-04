"use client";

import type { Intervention, Site } from "@/lib/supabase/types";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrap, Thead, Th, Tr, Td } from "@/components/ui/table";

export function QualityModule({ rows, sites }: { rows: Intervention[]; sites: Site[] }) {
  const rated = rows.filter((it) => it.quality_rating != null);

  function siteName(id: string | null) {
    return id ? sites.find((s) => s.id === id)?.name ?? "—" : "—";
  }

  if (rated.length === 0) {
    return (
      <Card>
        <h2 className="font-display text-sm font-bold">Qualité</h2>
        <div className="mt-4">
          <EmptyState icon="⭐" title="Aucune évaluation" description="Notez la qualité d'une intervention terminée pour voir apparaître les statistiques ici." />
        </div>
      </Card>
    );
  }

  const overallAvg = rated.reduce((s, it) => s + (it.quality_rating ?? 0), 0) / rated.length;

  const bySite = new Map<string, { total: number; count: number }>();
  for (const it of rated) {
    const key = it.site_id ?? "—";
    const cur = bySite.get(key) ?? { total: 0, count: 0 };
    bySite.set(key, { total: cur.total + (it.quality_rating ?? 0), count: cur.count + 1 });
  }

  const lowRated = rated.filter((it) => (it.quality_rating ?? 5) <= 2).sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Note moyenne globale" value={`${overallAvg.toFixed(1)} / 5`} sub={`${rated.length} intervention(s) notée(s)`} />
        <StatTile label="Interventions mal notées (≤2)" value={String(lowRated.length)} />
      </div>

      <Card>
        <h2 className="text-[13px] font-bold text-ink">Note moyenne par site</h2>
        <TableWrap>
          <Table className="mt-2">
            <Thead>
              <tr>
                <Th>Site</Th>
                <Th className="text-right">Note moyenne</Th>
                <Th className="text-right">Interventions notées</Th>
              </tr>
            </Thead>
            <tbody>
              {[...bySite.entries()].map(([siteId, agg]) => (
                <Tr key={siteId}>
                  <Td className="font-semibold text-ink">{siteId === "—" ? "Sans site" : siteName(siteId)}</Td>
                  <Td className="text-right">{(agg.total / agg.count).toFixed(1)} / 5</Td>
                  <Td className="text-right text-muted">{agg.count}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      {lowRated.length > 0 && (
        <Card className="border-amber-bg bg-amber-bg/40">
          <h2 className="text-[13px] font-bold text-amber-fg">Interventions à surveiller</h2>
          <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px]">
            {lowRated.map((it) => (
              <li key={it.id} className="text-amber-fg">
                {siteName(it.site_id)} — {new Date(it.scheduled_at).toLocaleDateString("fr-FR")} — {"★".repeat(it.quality_rating ?? 0)}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
