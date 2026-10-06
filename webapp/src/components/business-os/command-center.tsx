"use client";
import { useSyncExternalStore } from "react";
import type { CommandCenterData, CommandCenterAction } from "@/lib/command-center";
const subscribe=()=>()=>{};
const today=()=>new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
const server=()=>null;
export function CommandCenter({data,onNavigate,entityName="entreprise"}:{data:CommandCenterData;onNavigate:(tab:string,detailId?:string)=>void;entityName?:string}) {
 const label=useSyncExternalStore(subscribe,today,server);
 const actions=[...data.actions].sort((a,b)=>(b.priority??0)-(a.priority??0));
 const blocks=data.blockers??[];
 function actionRow(a:CommandCenterAction,i:number){return <button key={`${a.tab}-${a.detailId??a.text}`} type="button" className="pf-command-action" onClick={()=>onNavigate(a.tab,a.detailId)}><span>{String(i+1).padStart(2,"0")}</span><span><strong>{a.text}</strong><small>{a.reason??"Ouvrir le dossier concerné pour traiter cette action"}</small></span></button>;}
 return <section className="pf-command">
  <header className="pf-command-head"><div><p className="pf-eyebrow">VOTRE {entityName} AUJOURD’HUI</p><h2>Voici ce qui demande votre attention.</h2>{label && <p className="mt-2 text-xs capitalize text-muted">{label}</p>}</div><span>Vue opérationnelle</span></header>
  <div className="pf-command-facts">{data.today.map(f=><div key={f}>{f}</div>)}</div>
  <div className="pf-command-body"><div className="pf-command-section"><h3>À traiter maintenant · {actions.length}</h3>{actions.length?actions.map(actionRow):<p className="pf-command-empty">Aucune action prioritaire issue de vos données. Les dossiers à traiter apparaîtront ici dès leur enregistrement.</p>}{blocks.length>0&&<section className="mt-7"><h3>Blocages · {blocks.length}</h3>{blocks.map(actionRow)}</section>}</div>
   <aside className="pf-command-secondary"><section className="pf-command-section"><h3>Opportunités</h3>{data.opportunities.length?data.opportunities.map(a=><button type="button" className="pf-command-opportunity" key={`${a.tab}-${a.detailId??a.text}`} onClick={()=>onNavigate(a.tab,a.detailId)}>↗ {a.text}</button>):<p className="pf-command-empty">Aucune opportunité opérationnelle à signaler.</p>}</section><section className="pf-command-section"><h3>Planning</h3>{data.planning?.length?data.planning.map(actionRow):<p className="pf-command-empty">Aucune échéance enregistrée à venir.</p>}</section></aside>
  </div>
 </section>;
}
