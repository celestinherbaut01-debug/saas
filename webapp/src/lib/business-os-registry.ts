import type { BusinessOsVertical } from "@/lib/business-os";
/** Capability descriptions shared by onboarding and product headings; no pretend verticals. */
export const BUSINESS_OS_REGISTRY:Record<BusinessOsVertical,{workflow:readonly string[];scope:string}>={
 garage:{workflow:["Client","Véhicule","Diagnostic","Devis","Pièces","Intervention","Facture","Entretien"],scope:"L’atelier, les véhicules et les réparations"},
 agency:{workflow:["Client","Projet","Tâches","Livraison","Domaine","Maintenance","Facture"],scope:"La production web et les services récurrents"},
 cleaning:{workflow:["Client","Site","Contrat","Équipe","Intervention","Qualité","Facture"],scope:"Les interventions et les équipes sur le terrain"},
 restaurant:{workflow:["Fournisseur","Réception","Stock","Recette","Coût matière","Pertes","Réapprovisionnement"],scope:"Les ingrédients, les recettes et l’approvisionnement"},
 realestate:{workflow:["Propriétaire","Bien","Mandat","Publication","Visite","Offre","Vente / location"],scope:"Les biens, leurs acquéreurs et leur commercialisation"},
 generic:{workflow:["Client","Stock","Rendez-vous"],scope:"Le socle commun : clients, stock et rendez-vous. Aucun workflow spécialisé pour ce métier actuellement"},
};
