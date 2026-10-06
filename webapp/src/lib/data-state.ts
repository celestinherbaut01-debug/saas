export type DataFailureKind = "permission" | "schema" | "network";
export function classifyDataError(raw: unknown):DataFailureKind {
 const error=(raw && typeof raw === "object" ? raw : {}) as {code?:string;message?:string;status?:number};
 if(error.code === "42501" || error.code === "PGRST301" || error.status === 401 || error.status === 403) return "permission";
 if(["42P01","42703","PGRST200","PGRST204","PGRST205"].includes(error.code??"")) return "schema";
 return "network";
}
export class DataLoadError extends Error {
  readonly kind: DataFailureKind;
  constructor(error: { code?: string; message?: string; status?: number; details?: string; hint?: string }) {
    super("Données indisponibles");
    this.kind = classifyDataError(error);
    // Journalisation serveur de la VRAIE erreur Postgrest (code/message/
    // détails — jamais de clé ni de secret, ces champs n'en contiennent
    // pas) : sans ça, l'écran "CHARGEMENT INTERROMPU" masque tout et seul
    // un "GET /dashboard 200" apparaît dans le terminal.
    console.error(`[DataLoadError:${this.kind}]`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }
}
export async function checkedAll<const T extends readonly unknown[]>(queries:{[K in keyof T]:T[K]}) : Promise<{[K in keyof T]:Awaited<T[K]>}> {
 const results=await Promise.all(queries);
 for(const result of results) if(result && typeof result === "object" && "error" in result && result.error) throw new DataLoadError(result.error as {code?:string;message?:string;status?:number});
 return results;
}
export function requireRead<T>(result:{data:T;error:{code?:string;message?:string}|null}):T { if(result.error) throw new DataLoadError(result.error); return result.data; }
