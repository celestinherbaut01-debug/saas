"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
const AREAS:Record<string,{name:string;line:string;detail:string;cta:string;href:string;index:string}>={
 "/dashboard":{name:"Vue d’ensemble",line:"Votre prochain mouvement.",detail:"L’activité commerciale et les rendez-vous réunis pour garder le cap.",cta:"Ouvrir mon entreprise",href:"/business-os",index:"01"},
 "/business-os":{name:"Opérations",line:"L’entreprise en mouvement.",detail:"Du premier client à la prestation terminée, chaque étape a sa place.",cta:"Voir les missions",href:"/missions",index:"02"},
 "/crm":{name:"Relation client",line:"Des conversations qui avancent.",detail:"Priorisez les relances. Transformez les opportunités en clients.",cta:"Trouver des prospects",href:"/prospection",index:"03"},
 "/analytics":{name:"Performance",line:"Comprendre ce qui progresse.",detail:"Votre activité mesurée à partir des résultats enregistrés.",cta:"Voir le pipeline",href:"/crm",index:"04"},
 "/missions":{name:"Exécution",line:"Une direction. Des actions.",detail:"Avancez sur les objectifs de votre entreprise, étape après étape.",cta:"Explorer NOVA",href:"/nova/actions",index:"05"},
 "/nova":{name:"Intelligence",line:"Donnez du sens à vos données.",detail:"Des opportunités expliquées, reliées à votre activité.",cta:"Voir les missions",href:"/missions",index:"06"},
 "/studio":{name:"Communication",line:"Une offre. Cinq prises de parole.",detail:"Vos informations deviennent des contenus adaptés à chaque canal.",cta:"Voir mon entreprise",href:"/business-os",index:"07"},
 "/prospection":{name:"Acquisition",line:"Votre prochaine rencontre.",detail:"Construisez une sélection d’entreprises adaptée à votre offre.",cta:"Ouvrir le CRM",href:"/crm",index:"08"},
 "/abonnement":{name:"Votre espace",line:"L’offre qui suit votre activité.",detail:"Acquisition, opérations ou les deux : choisissez ce dont vous avez besoin.",cta:"Comparer les tarifs",href:"/tarifs",index:"09"},
};
export function WorkspaceIntro(){const path=usePathname();const area=AREAS['/'+path.split('/')[1]];if(!area || path.split('/').length>3)return null;return <section className={`pf-intro pf-intro-${area.index}`}><div className="pf-intro-copy"><p className="pf-eyebrow">PROSPECTFLOW / {area.name}</p><h2>{area.line}</h2><p>{area.detail}</p><Link href={area.href}>{area.cta}<span aria-hidden>↗</span></Link></div><div className="pf-flowmark" aria-hidden><span/><span/><span/><b>{area.index}</b></div></section>;}
