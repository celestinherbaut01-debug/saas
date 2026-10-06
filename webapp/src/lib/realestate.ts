import type { StudioInput } from "@/lib/studio/types";
import { EMPTY_STUDIO_INPUT } from "@/lib/studio/types";
import type { StudioPhoto } from "@/lib/studio/photos";
export const PROPERTY_STAGES = [
  ["new", "Nouveau"], ["mandate", "Mandat"], ["to_publish", "À publier"],
  ["published", "Publié"], ["visits", "Visites"], ["offer", "Offre reçue"],
  ["accepted", "Sous compromis / accepté"], ["closed", "Vendu / loué"],
] as const;
export type PropertyStage = typeof PROPERTY_STAGES[number][0];
interface Base { id: string; workspace_id: string; created_at: string; updated_at: string }
export interface PropertyOwner extends Base { customer_id: string | null; name: string; email: string | null; phone: string | null; notes: string }
export interface Property extends Base {
 title: string; owner_id: string | null; property_type: string | null; address: string | null;
 city: string | null; surface_m2: number | null; rooms: number | null; bedrooms: number | null;
 price: number | null; description: string; features: string[]; status: PropertyStage;
 transaction_type: "sale" | "rent"; photos: StudioPhoto[]; dpe: string | null;
}
export interface PropertyMandate extends Base { property_id: string; owner_id: string; mandate_type: "simple" | "exclusive"; starts_on: string; expires_on: string | null; status: "active" | "expired" | "closed" }
export interface PropertyBuyer extends Base { name: string; email: string | null; phone: string | null; criteria: string; budget: number | null; interested_property_ids: string[] }
export interface PropertyVisit extends Base { property_id: string; buyer_id: string; starts_at: string; status: "planned" | "completed" | "canceled"; report: string }
export interface PropertyOffer extends Base { property_id: string; buyer_id: string; amount: number; status: "pending" | "accepted" | "rejected"; notes: string }
export interface RealEstateData { owners: PropertyOwner[]; properties: Property[]; mandates: PropertyMandate[]; buyers: PropertyBuyer[]; visits: PropertyVisit[]; offers: PropertyOffer[] }
export type EstateEntity = keyof RealEstateData;
export const ESTATE_TABLES = { owners: "property_owners", properties: "properties", mandates: "property_mandates", buyers: "property_buyers", visits: "property_visits", offers: "property_offers" } as const;
export function propertyToStudioInput(p: Property): StudioInput {
 return { ...EMPTY_STUDIO_INPUT, title: p.title, description: p.description, highlights: p.features,
 price: p.price == null ? null : `${p.price.toLocaleString("fr-FR")} €${p.transaction_type === "rent" ? " / mois" : ""}`,
 propertyType: p.property_type, surfaceM2: p.surface_m2, rooms: p.rooms, bedrooms: p.bedrooms,
 city: p.city, neighborhood: p.address, dpe: p.dpe };
}
export function estateAttention(data: RealEstateData, now = new Date()) {
 const dateKey=(d:Date)=>d.toLocaleDateString("en-CA",{timeZone:"Europe/Paris"});
 const day = dateKey(now), limit = dateKey(new Date(now.getTime()+30*86400000));
 const visits = data.visits.filter(v=>v.status === "planned" && dateKey(new Date(v.starts_at)) === day);
 const expiring = data.mandates.filter(m=>m.status === "active" && m.expires_on && m.expires_on <= limit);
 const unpublished = data.properties.filter(p=>["mandate","to_publish"].includes(p.status));
 const pending = data.offers.filter(o=>o.status === "pending");
 return { visits, expiring, unpublished, pending, newBuyers: data.buyers.filter(b=>dateKey(new Date(b.created_at)) === day) };
}
