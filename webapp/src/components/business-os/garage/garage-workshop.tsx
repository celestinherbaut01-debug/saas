"use client";
import { useState } from "react";
import type { RepairOrder, Vehicle, Customer, TeamMember } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { GARAGE_NEXT_STATUS, garageWorkshopStage } from "@/lib/garage-workflow";
import { REPAIR_STATUS_LABEL } from "@/lib/garage";
const COLUMNS=[ ["upcoming","À venir"],["diagnostic","Diagnostic"],["quote","Devis en attente"],["accepted","Validé · à lancer"],["waiting_parts","En attente de pièces"],["in_progress","En intervention"],["done","Prêt"],["delivered","Terminé"] ] as const;

export function WorkshopModule({rows,vehicles,customers,technicians,onAdvance,onOpenDetail,onUpdateVehicle}:{rows:RepairOrder[];vehicles:Vehicle[];customers:Customer[];technicians:TeamMember[];onAdvance:(order:RepairOrder,next:RepairOrder["status"])=>void|Promise<void>;onOpenDetail:(id:string)=>void;onUpdateVehicle?:(id:string,patch:Partial<Vehicle>)=>Promise<void>}){
 const [busy,setBusy]=useState<string|null>(null);

 async function advance(r:RepairOrder,status:RepairOrder["status"]){if(busy)return;setBusy(r.id);try{await onAdvance(r,status);}finally{setBusy(null);}}
 return <section className="pf-workflow"><p className="pf-eyebrow">ATELIER EN DIRECT</p><h2 className="mt-2 text-2xl font-bold">Chaque véhicule, à sa place.</h2><p className="mt-2 text-sm text-muted">Ouvrez un dossier pour relier diagnostic, pièces, technicien, devis et facture.</p><div className="pf-board">{COLUMNS.map(([stage,label])=>{
 const items=rows.filter(r=>garageWorkshopStage(r)===stage),visible=stage==="delivered"?items.slice(0,20):items;
 return <div className="pf-lane" key={stage}><h3>{label}<span>{items.length}</span></h3>{visible.map(r=>{
 const v=vehicles.find(v=>v.id===r.vehicle_id),c=customers.find(c=>c.id===r.customer_id),t=technicians.find(t=>t.id===r.technician_id),next=GARAGE_NEXT_STATUS[r.status];
 return <article className="pf-property" key={r.id}><button type="button" className="text-left" onClick={()=>onOpenDetail(r.id)}><strong>{v?.registration??r.title} ↗</strong></button><span>{r.title}</span><span>{c?.name??"Client à renseigner"}</span>{r.scheduled_at&&<span>{new Date(r.scheduled_at).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})}</span>}<span>{t?.name??"Technicien non affecté"}</span>{next&&stage!=="upcoming"&&<Button size="sm" disabled={busy!==null} onClick={()=>void advance(r,next)}>→ {REPAIR_STATUS_LABEL[next].text}</Button>}{stage==="upcoming"&&<Button size="sm" variant="outline" onClick={()=>onOpenDetail(r.id)}>Accueillir / replanifier</Button>}{["accepted","in_progress"].includes(r.status)&&<Button size="sm" variant="outline" disabled={busy!==null} onClick={()=>void advance(r,"waiting_parts")}>Pièce manquante</Button>}{v && ["done","delivered"].includes(r.status) && <label className="text-xs text-muted">Prochain entretien<input aria-label={`Prochain entretien ${v.registration}`} type="date" className="mt-1 w-full rounded-lg border border-line bg-soft p-2" value={v.next_maintenance_on??""} onChange={e=>void onUpdateVehicle?.(v.id,{next_maintenance_on:e.target.value||null})}/></label>}{r.status==="done"&&<Button size="sm" variant="ghost" onClick={()=>onOpenDetail(r.id)}>Facturer / prévenir le client →</Button>}</article>;
 })}{!items.length&&<p className="pf-lane-empty">Aucun véhicule à cette étape</p>}</div>;
 })}</div></section>;
}
