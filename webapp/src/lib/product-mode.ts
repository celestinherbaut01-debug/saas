export type ProductMode = "acquisition" | "business_os" | "both";

export const PRODUCT_MODE_OPTIONS: { value: ProductMode; label: string; desc: string }[] = [
  { value: "acquisition", label: "Trouver plus de clients", desc: "Prospection, CRM et NOVA commercial mis en avant." },
  { value: "business_os", label: "Gérer mon entreprise", desc: "Business OS mis en avant, prospection en option." },
  { value: "both", label: "Les deux", desc: "Acquisition et Business OS visibles ensemble." },
];
