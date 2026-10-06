"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWorkspacePlan } from "@/lib/plan";
import { businessOsAtLeast } from "@/lib/entitlements";
import { ESTATE_TABLES, PROPERTY_STAGES, type EstateEntity } from "@/lib/realestate";
import type { Database } from "@/lib/supabase/types";
import { STUDIO_PHOTOS_BUCKET, buildPhotoPath, validatePhotoFile, parsePhotos } from "@/lib/studio/photos";
const FIELDS = {
 owners: ["customer_id","name", "email", "phone", "notes"],
 properties: ["title","owner_id","property_type","address","city","surface_m2","rooms","bedrooms","price","description","features","status","transaction_type","dpe"],
 mandates: ["property_id","owner_id","mandate_type","starts_on","expires_on","status"],
 buyers: ["name","email","phone","criteria","budget","interested_property_ids"],
 visits: ["property_id","buyer_id","starts_at","status","report"],
 offers: ["property_id","buyer_id","amount","status","notes"],
} as const;
const DEFAULTS: Record<EstateEntity, Record<string, unknown>> = {
 owners: { customer_id:null,name:"",email:null,phone:null,notes:"" },
 properties: { title:"",owner_id:null,property_type:null,address:null,city:null,surface_m2:null,rooms:null,bedrooms:null,price:null,description:"",features:[],status:"new",transaction_type:"sale",dpe:null,photos:[] },
 mandates: {property_id:"",owner_id:"",mandate_type:"simple",starts_on:"",expires_on:null,status:"active"},
 buyers: {name:"",email:null,phone:null,criteria:"",budget:null,interested_property_ids:[]},
 visits: {property_id:"",buyer_id:"",starts_at:"",status:"planned",report:""},
 offers: {property_id:"",buyer_id:"",amount:null,status:"pending",notes:""},
};
async function authorized(workspaceId: string) {
 const db=await createClient(); const {data:{user},error}=await db.auth.getUser();
 if(error || !user) throw new Error("Session expirée. Reconnectez-vous.");
 const {data:member,error:memberError}=await db.from("workspace_members").select("workspace_id").eq("workspace_id",workspaceId).eq("user_id",user.id).maybeSingle();
 if(memberError || !member) throw new Error("Accès à cet espace refusé.");
 if(!businessOsAtLeast(await getWorkspacePlan(workspaceId),"standard")) throw new Error("Business OS doit être activé.");
 return db;
}
export async function saveEstateEntity(workspaceId: string, entity: EstateEntity, id: string | null, input: Record<string,unknown>) {
 try {
 if(!Object.hasOwn(ESTATE_TABLES,entity)) return {ok:false,error:"Objet inconnu."};
 const db=await authorized(workspaceId);
 const values:Record<string,unknown>=id ? {} : {...DEFAULTS[entity]};
 for(const key of FIELDS[entity]) if(Object.hasOwn(input,key)) values[key]=typeof input[key]==="string" ? input[key].trim() : input[key];
 for(const key of ["surface_m2","rooms","bedrooms","price","budget","amount"]) {
  if(!Object.hasOwn(values,key)) continue;
  const raw=values[key]; values[key]=raw==null || raw==="" ? null : Number(raw);
  if(values[key]!=null && (!Number.isFinite(values[key]) || Number(values[key])<0)) return {ok:false,error:"Montant ou dimension invalide."};
 }
 for(const key of ["customer_id","owner_id","email","phone","address","city","property_type","expires_on","dpe"]) if(values[key]==="") values[key]=null;
 const required = entity==="properties" ? ["title"] : entity==="owners" || entity==="buyers" ? ["name"] : entity==="mandates" ? ["property_id","owner_id","starts_on"] : entity==="visits" ? ["property_id","buyer_id","starts_at"] : ["property_id","buyer_id","amount"];
 if(required.some(k=>Object.hasOwn(values,k) && !values[k])) return {ok:false,error:"Complétez les champs obligatoires."};
 if(entity==="properties" && values.status && !PROPERTY_STAGES.some(([k])=>k===values.status)) return {ok:false,error:"Étape invalide."};
 if(entity==="buyers" && Array.isArray(values.interested_property_ids) && values.interested_property_ids.length) {
  const {data,error}=await db.from("properties").select("id").eq("workspace_id",workspaceId).in("id",values.interested_property_ids as string[]);
  if(error || data?.length!==values.interested_property_ids.length) return {ok:false,error:"Un des biens sélectionnés est inaccessible."};
 }
 const result=await persist();
 async function persist() {
 if(entity==="owners") {
 const table="property_owners"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 if(entity==="properties") {
 const table="properties"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 if(entity==="mandates") {
 const table="property_mandates"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 if(entity==="buyers") {
 const table="property_buyers"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 if(entity==="visits") {
 const table="property_visits"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 if(entity==="offers") {
 const table="property_offers"; const patch=values as Database["public"]["Tables"][typeof table]["Update"];
 return id ? await db.from(table).update(patch).eq("id",id).eq("workspace_id",workspaceId).select("*").single() : await db.from(table).insert({...values,workspace_id:workspaceId} as Database["public"]["Tables"][typeof table]["Insert"]).select("*").single();
 }
 throw new Error("Objet inconnu");
 }
 if(result.error) return {ok:false,error:result.error.message};
 let property = null;
 if(["mandates","visits","offers"].includes(entity) && result.data && "property_id" in result.data) {
  const read=await db.from("properties").select("*").eq("workspace_id",workspaceId).eq("id",result.data.property_id).single();
  if(read.error) return {ok:false,error:"Le dossier a été enregistré mais sa nouvelle étape n’a pas pu être rechargée. Rechargez la page."};
  property=read.data;
 }
 revalidatePath("/business-os"); return {ok:true,row:result.data,property};
 } catch(e) {return {ok:false,error:e instanceof Error ? e.message : "Enregistrement impossible."};}
}
export async function uploadPropertyPhoto(workspaceId:string,propertyId:string,file:File) {
 try {
 const validation=validatePhotoFile(file); if(validation) return {ok:false,error:validation};
 const db=await authorized(workspaceId);
 const {data:property,error}=await db.from("properties").select("photos").eq("workspace_id",workspaceId).eq("id",propertyId).single();
 if(error || !property) return {ok:false,error:"Bien inaccessible."};
 const path=buildPhotoPath(workspaceId,propertyId,file.name,crypto.randomUUID());
 const uploaded=await db.storage.from(STUDIO_PHOTOS_BUCKET).upload(path,file,{contentType:file.type});
 if(uploaded.error) return {ok:false,error:uploaded.error.message};
 const photos=[...parsePhotos(property.photos),{path}];
 const result=await db.from("properties").update({photos}).eq("workspace_id",workspaceId).eq("id",propertyId);
 if(result.error) {await db.storage.from(STUDIO_PHOTOS_BUCKET).remove([path]);return {ok:false,error:result.error.message};}
 revalidatePath("/business-os");return {ok:true,photos};
 } catch(e) { return {ok:false,error:e instanceof Error ? e.message : "Photo non enregistrée."}; }
}
