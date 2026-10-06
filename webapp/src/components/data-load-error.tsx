import Link from "next/link";
import type { DataFailureKind } from "@/lib/data-state";
const TEXT:Record<DataFailureKind,{title:string;body:string}>={
 permission:{title:"Accès aux données refusé",body:"Votre session ou les permissions de cet espace ne permettent pas cette lecture. Reconnectez-vous ou contactez le propriétaire de l’espace."},
 schema:{title:"Mise à jour des données nécessaire",body:"Une table ou un champ manque. Appliquez les migrations du projet avant de recharger cette page."},
 network:{title:"Données temporairement indisponibles",body:"La lecture a échoué. Vérifiez votre connexion puis réessayez. Vos enregistrements ne sont pas présentés comme une liste vide."},
};
export function DataLoadErrorView({kind}:{kind:DataFailureKind}) {return <main className="mx-auto max-w-xl px-6 py-20"><section role="alert" className="pf-register"><p className="pf-eyebrow">CHARGEMENT INTERROMPU</p><h1 className="mt-3 text-2xl font-bold">{TEXT[kind].title}</h1><p className="mt-4 text-muted">{TEXT[kind].body}</p><div className="mt-6 flex gap-4"><a href="" className="pf-studio-link">Réessayer</a><Link href="/dashboard">Tableau de bord →</Link></div></section></main>;}
