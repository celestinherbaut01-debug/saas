import { createClient } from "@/lib/supabase/server";
import { getCachedBusinessOsProfile } from "@/lib/session";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
import { checkedAll } from "@/lib/data-state";
import { PROPERTY_STAGES } from "@/lib/realestate";
const SOURCES={garage:{table:"repair_orders",name:"Ordres atelier"},agency:{table:"projects",name:"Projets"},cleaning:{table:"interventions",name:"Interventions"},restaurant:{table:"purchase_orders",name:"Commandes fournisseur"},realestate:{table:"properties",name:"Biens"}} as const;
const LABELS:Record<string,string>={diagnostic:"Diagnostic",quote:"Devis",accepted:"Validé / accepté",waiting_parts:"Pièces attendues",in_progress:"En cours",done:"Terminé",delivered:"Livré",maintenance:"Maintenance",planned:"Planifié",missed:"Non réalisé",draft:"Brouillon",ordered:"Commandé",received:"Reçu",canceled:"Annulé",...Object.fromEntries(PROPERTY_STAGES)};
export async function OperationalAnalytics({workspaceId}:{workspaceId:string}) {
 if(!businessOsAtLeast(await getWorkspacePlan(workspaceId),"standard"))return null;
 const profile=await getCachedBusinessOsProfile(workspaceId);if(profile.vertical==="generic")return null;
 const db=await createClient(),source=SOURCES[profile.vertical];
 let query=db.from(source.table).select("status").eq("workspace_id",workspaceId);
 if(profile.vertical==="garage"||profile.vertical==="agency")query=query.is("archived_at",null);
 const [operations,studio]=await checkedAll([
  query,
  db.from("studio_creations").select("status,source_property_id").eq("workspace_id",workspaceId),
 ]);
 const rows=operations.data??[],creations=studio.data??[];
 const groups=rows.reduce<Record<string,number>>((out,row)=>{out[row.status]=(out[row.status]??0)+1;return out;},{});
 return <section className="pf-register"><p className="pf-eyebrow">DE L’ACQUISITION AUX OPÉRATIONS</p><div className="mt-3 grid gap-8 lg:grid-cols-[1.4fr_1fr]"><section><h2 className="text-xl font-bold">{source.name} · {rows.length} enregistrés</h2><p className="mt-2 text-xs text-muted">Répartition des dossiers actuellement enregistrés par étape.</p><div className="mt-6 space-y-4">{Object.entries(groups).map(([status,count])=><div key={status}><div className="mb-2 flex justify-between text-xs"><span>{LABELS[status]??status}</span><strong>{count}</strong></div><div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-3" style={{width:`${count/rows.length*100}%`}}/></div></div>)}</div>{rows.length===0&&<p className="pf-command-empty">Aucun dossier enregistré : aucun taux n’est calculé.</p>}</section><aside className="rounded-2xl border border-line bg-soft p-6"><p className="pf-eyebrow">STUDIO</p><h3 className="mt-3 text-3xl font-bold">{creations.length}</h3><p className="mt-2 text-sm text-muted">Créations enregistrées</p><div className="mt-5 flex justify-between border-t border-line pt-4 text-xs"><span>Issues d’un bien</span><strong>{creations.filter(c=>c.source_property_id).length}</strong></div><div className="mt-4 flex justify-between text-xs"><span>Marquées publiées par l’utilisateur</span><strong>{creations.filter(c=>c.status==="published").length}</strong></div><p className="mt-5 text-xs leading-relaxed text-muted">Ces comptages mesurent les dossiers et contenus sauvegardés. Ils ne mesurent ni portée sur les réseaux ni chiffre d’affaires attribué.</p></aside></div></section>;
}
