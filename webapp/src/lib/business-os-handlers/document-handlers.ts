"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, BusinessDocument, DocumentItem } from "@/lib/supabase/types";
import { computeDocumentTotals, nextDocumentNumber } from "@/lib/document-totals";
import type { DocumentCreateInput } from "@/components/business-os/documents-module";

type LinkField = "project_id" | "repair_order_id" | "contract_id";

/**
 * Mutations devis/factures partagées par Garage, Nettoyage et Agence —
 * écrites une seule fois plutôt que dupliquées trois fois (même logique
 * exacte attendue partout : numérotation, calcul des totaux à partir des
 * lignes, copie des lignes lors d'une conversion devis -> facture, garde
 * contre une double conversion). `linkField` isole la seule chose qui
 * change entre verticales : quelle colonne de `documents` porte le lien
 * optionnel vers l'ordre de réparation / le contrat / le projet.
 */
export function makeDocumentHandlers({
  supabase,
  workspaceId,
  linkField,
  getDocuments,
  setDocuments,
  getDocumentItems,
  setDocumentItems,
  setMutationError,
}: {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  linkField?: LinkField;
  getDocuments: () => BusinessDocument[];
  setDocuments: (updater: (prev: BusinessDocument[]) => BusinessDocument[]) => void;
  getDocumentItems: () => Record<string, DocumentItem[]>;
  setDocumentItems: (updater: (prev: Record<string, DocumentItem[]>) => Record<string, DocumentItem[]>) => void;
  setMutationError: (msg: string | null) => void;
}) {
  function countThisYear(docType: BusinessDocument["doc_type"]) {
    const year = new Date().getFullYear();
    return getDocuments().filter((d) => d.doc_type === docType && new Date(d.issued_at).getFullYear() === year).length;
  }

  async function createDocument(docType: BusinessDocument["doc_type"], input: DocumentCreateInput) {
    const totals = computeDocumentTotals(input.items);
    const number = nextDocumentNumber(docType, countThisYear(docType));

    const linkPayload: Partial<Database["public"]["Tables"]["documents"]["Insert"]> = {};
    if (linkField === "project_id") linkPayload.project_id = input.linkedId || null;
    if (linkField === "repair_order_id") linkPayload.repair_order_id = input.linkedId || null;
    if (linkField === "contract_id") linkPayload.contract_id = input.linkedId || null;

    const { data, error } = await supabase
      .from("documents")
      .insert({
        workspace_id: workspaceId,
        doc_type: docType,
        customer_id: input.customerId || null,
        ...linkPayload,
        number,
        total_ht: totals.totalHt,
        total_ttc: totals.totalTtc,
        issued_at: input.issuedAt || new Date().toISOString().slice(0, 10),
        due_at: input.dueAt || null,
        notes: input.notes.trim(),
        status: "draft",
      })
      .select("*")
      .single();
    if (error || !data) {
      setMutationError(error?.message ?? "Échec de la création du document.");
      return;
    }

    const { data: insertedItems, error: itemsError } = await supabase
      .from("document_items")
      .insert(
        input.items.map((l, i) => ({
          workspace_id: workspaceId,
          document_id: data.id,
          description: l.description.trim(),
          quantity: l.quantity,
          unit_price_ht: l.unitPriceHt,
          vat_rate: l.vatRate,
          sort_order: i,
        })),
      )
      .select("*");

    setDocuments((prev) => [data, ...prev]);
    if (insertedItems) setDocumentItems((prev) => ({ ...prev, [data.id]: insertedItems }));
    setMutationError(itemsError ? `Document créé mais les lignes n'ont pas pu être enregistrées : ${itemsError.message}` : null);
  }

  async function deleteDraftDocument(doc: BusinessDocument) {
    if (doc.status !== "draft") return;
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      setMutationError(error.message);
      return;
    }
    setMutationError(null);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  /**
   * Conversion devis -> facture : copie les lignes réelles (jamais un
   * montant recalculé différemment), lie les deux documents dans les deux
   * sens (`converted_to_document_id` sur le devis), et refuse silencieusement
   * si le devis porte déjà ce champ — un deuxième clic (double-clic, deux
   * onglets) ne peut donc jamais créer une deuxième facture pour le même devis.
   */
  async function convertQuoteToInvoice(quote: BusinessDocument) {
    if (quote.converted_to_document_id) return;
    const items = getDocumentItems()[quote.id] ?? [];
    const number = nextDocumentNumber("invoice", countThisYear("invoice"));

    const { data, error } = await supabase
      .from("documents")
      .insert({
        workspace_id: workspaceId,
        doc_type: "invoice",
        customer_id: quote.customer_id,
        project_id: quote.project_id,
        repair_order_id: quote.repair_order_id,
        contract_id: quote.contract_id,
        number,
        total_ht: quote.total_ht,
        total_ttc: quote.total_ttc,
        due_at: quote.due_at,
        notes: quote.notes,
        status: "draft",
      })
      .select("*")
      .single();
    if (error || !data) {
      setMutationError(error?.message ?? "Échec de la conversion en facture.");
      return;
    }

    let itemsErrorMessage: string | null = null;
    if (items.length > 0) {
      const { data: clonedItems, error: itemsError } = await supabase
        .from("document_items")
        .insert(
          items.map((l) => ({
            workspace_id: workspaceId,
            document_id: data.id,
            description: l.description,
            quantity: l.quantity,
            unit_price_ht: l.unit_price_ht,
            vat_rate: l.vat_rate,
            sort_order: l.sort_order,
          })),
        )
        .select("*");
      if (itemsError) itemsErrorMessage = `Facture créée mais les lignes n'ont pas pu être copiées : ${itemsError.message}`;
      if (clonedItems) setDocumentItems((prev) => ({ ...prev, [data.id]: clonedItems }));
    }

    const { error: linkError } = await supabase.from("documents").update({ converted_to_document_id: data.id }).eq("id", quote.id);

    setDocuments((prev) => [data, ...prev.map((d) => (d.id === quote.id ? { ...d, converted_to_document_id: data.id } : d))]);
    setMutationError(itemsErrorMessage ?? (linkError ? `Facture créée mais le devis n'a pas pu être marqué comme converti : ${linkError.message}` : null));
  }

  return { createDocument, deleteDraftDocument, convertQuoteToInvoice };
}
