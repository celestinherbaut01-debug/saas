// Types manuels reflétant supabase/migrations/*.sql (Phase 1).
// À remplacer plus tard par `supabase gen types typescript` une fois un
// projet Supabase réel lié — voir README pour la commande.
//
// Chaque table doit inclure `Relationships` (même vide) : c'est une
// contrainte du générique `GenericTable` de @supabase/postgrest-js, sans
// quoi TypeScript retombe silencieusement sur `never` pour insert/update.

import type { ProspectStatus } from "@/lib/crm-status";

interface Relationship {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          plan: "free" | "acquisition_starter" | "acquisition_pro" | "business_os" | "business_os_advanced" | "complete" | "complete_max";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          plan?: "free" | "acquisition_starter" | "acquisition_pro" | "business_os" | "business_os_advanced" | "complete" | "complete_max";
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Row"]>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Row"]>;
        Relationships: [
          Relationship & {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      business_profiles: {
        Row: {
          workspace_id: string;
          company_name: string;
          website: string | null;
          offer_description: string;
          audience: "b2b" | "b2c" | "both";
          product_mode: "acquisition" | "business_os" | "both";
          own_category_id: string | null;
          street: string;
          postal_code: string;
          city: string;
          lat: number | null;
          lng: number | null;
          default_radius_km: number;
          tone: string;
          signature: string;
          agent_instruction: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["business_profiles"]["Row"]> & {
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_profiles"]["Row"]>;
        Relationships: [];
      };
      business_categories: {
        Row: {
          id: string;
          parent_id: string | null;
          slug: string;
          name: string;
          icon: string | null;
          naf_codes: string[];
          keywords: string[];
          business_type: "b2b" | "b2c" | "both";
          sort_order: number;
        };
        Insert: Partial<Database["public"]["Tables"]["business_categories"]["Row"]> & {
          slug: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_categories"]["Row"]>;
        Relationships: [];
      };
      workspace_targets: {
        Row: {
          workspace_id: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          category_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_targets"]["Row"]>;
        Relationships: [];
      };
      prospects: {
        Row: {
          id: string;
          workspace_id: string;
          siren: string;
          siret: string;
          company_name: string;
          category_id: string | null;
          naf_code: string | null;
          street: string | null;
          postal_code: string | null;
          city: string | null;
          lat: number | null;
          lng: number | null;
          distance_km: number | null;
          legal_status: string | null;
          nature_juridique: string | null;
          effectif_tranche: string | null;
          is_association: boolean;
          is_large_group: boolean;
          is_chain: boolean;
          place_id: string | null;
          business_status: string | null;
          website_uri: string | null;
          website_quality: string | null;
          phone: string | null;
          google_rating: number | null;
          google_rating_count: number | null;
          places_checked_at: string | null;
          quality_score: number;
          verification_sources: Record<string, boolean>;
          status: ProspectStatus;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prospects"]["Row"]> & {
          workspace_id: string;
          siren: string;
          siret: string;
          company_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Row"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          workspace_id: string;
          plan: "free" | "acquisition_starter" | "acquisition_pro" | "business_os" | "business_os_advanced" | "complete" | "complete_max";
          status: "active" | "trialing" | "past_due" | "canceled";
          billing_period: "monthly" | "yearly" | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]> & {
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          quantity: number;
          unit: string;
          low_stock_threshold: number | null;
          unit_cost: number;
          supplier_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["inventory_items"]["Row"]>;
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          prospect_id: string | null;
          title: string;
          starts_at: string;
          ends_at: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["appointments"]["Row"]> & {
          workspace_id: string;
          title: string;
          starts_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["appointments"]["Row"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          registration: string;
          make: string;
          model: string;
          year: number | null;
          mileage: number | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["vehicles"]["Row"]> & {
          workspace_id: string;
          registration: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Row"]>;
        Relationships: [];
      };
      repair_orders: {
        Row: {
          id: string;
          workspace_id: string;
          vehicle_id: string | null;
          customer_id: string | null;
          technician_id: string | null;
          title: string;
          status: "diagnostic" | "quote" | "accepted" | "in_progress" | "waiting_parts" | "done" | "delivered";
          scheduled_at: string | null;
          completed_at: string | null;
          delivered_at: string | null;
          labor_cost: number;
          parts_cost: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["repair_orders"]["Row"]> & {
          workspace_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["repair_orders"]["Row"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          role: string;
          phone: string | null;
          email: string | null;
          active: boolean;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["team_members"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Row"]>;
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["suppliers"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Row"]>;
        Relationships: [];
      };
      parts: {
        Row: {
          id: string;
          workspace_id: string;
          supplier_id: string | null;
          name: string;
          reference: string;
          unit_cost: number;
          unit_price: number;
          quantity: number;
          unit: string;
          low_stock_threshold: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["parts"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["parts"]["Row"]>;
        Relationships: [];
      };
      repair_order_parts: {
        Row: {
          id: string;
          workspace_id: string;
          repair_order_id: string;
          part_id: string | null;
          part_name: string;
          quantity: number;
          unit_cost: number;
          unit_price: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["repair_order_parts"]["Row"]> & {
          workspace_id: string;
          repair_order_id: string;
          part_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["repair_order_parts"]["Row"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          doc_type: "quote" | "invoice";
          status: "draft" | "sent" | "accepted" | "refused" | "paid" | "overdue" | "canceled";
          customer_id: string | null;
          repair_order_id: string | null;
          project_id: string | null;
          contract_id: string | null;
          number: string;
          total_ht: number;
          total_ttc: number;
          issued_at: string;
          due_at: string | null;
          paid_at: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["documents"]["Row"]> & {
          workspace_id: string;
          doc_type: "quote" | "invoice";
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Row"]>;
        Relationships: [];
      };
      client_sites: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          project_id: string | null;
          domain_name: string;
          hosting_provider: string;
          domain_renewal_date: string | null;
          hosting_renewal_date: string | null;
          next_maintenance_at: string | null;
          monthly_price: number;
          status: "active" | "maintenance" | "inactive";
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_sites"]["Row"]> & { workspace_id: string };
        Update: Partial<Database["public"]["Tables"]["client_sites"]["Row"]>;
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          site_id: string | null;
          title: string;
          priority: "low" | "normal" | "high" | "urgent";
          status: "open" | "in_progress" | "resolved" | "closed";
          notes: string;
          created_at: string;
          resolved_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tickets"]["Row"]> & { workspace_id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["tickets"]["Row"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          project_id: string | null;
          title: string;
          done: boolean;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tasks"]["Row"]> & { workspace_id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
        Relationships: [];
      };
      sites: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          name: string;
          address: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sites"]["Row"]> & { workspace_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["sites"]["Row"]>;
        Relationships: [];
      };
      interventions: {
        Row: {
          id: string;
          workspace_id: string;
          contract_id: string | null;
          site_id: string | null;
          team_member_id: string | null;
          scheduled_at: string;
          completed_at: string | null;
          status: "planned" | "done" | "missed";
          quality_rating: number | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interventions"]["Row"]> & { workspace_id: string; scheduled_at: string };
        Update: Partial<Database["public"]["Tables"]["interventions"]["Row"]>;
        Relationships: [];
      };
      incidents: {
        Row: {
          id: string;
          workspace_id: string;
          contract_id: string | null;
          site_id: string | null;
          title: string;
          severity: "low" | "medium" | "high";
          status: "open" | "resolved";
          notes: string;
          reported_at: string;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["incidents"]["Row"]> & { workspace_id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["incidents"]["Row"]>;
        Relationships: [];
      };
      purchase_orders: {
        Row: {
          id: string;
          workspace_id: string;
          supplier_id: string | null;
          status: "draft" | "ordered" | "received" | "canceled";
          total_cost: number;
          ordered_at: string | null;
          received_at: string | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]> & { workspace_id: string };
        Update: Partial<Database["public"]["Tables"]["purchase_orders"]["Row"]>;
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          id: string;
          workspace_id: string;
          purchase_order_id: string;
          inventory_item_id: string | null;
          item_name: string;
          quantity: number;
          unit_cost: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["purchase_order_items"]["Row"]> & {
          workspace_id: string;
          purchase_order_id: string;
          item_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["purchase_order_items"]["Row"]>;
        Relationships: [];
      };
      recipes: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          selling_price: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["recipes"]["Row"]> & { workspace_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["recipes"]["Row"]>;
        Relationships: [];
      };
      recipe_ingredients: {
        Row: {
          id: string;
          workspace_id: string;
          recipe_id: string;
          inventory_item_id: string | null;
          item_name: string;
          quantity: number;
          unit_cost: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["recipe_ingredients"]["Row"]> & {
          workspace_id: string;
          recipe_id: string;
          item_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["recipe_ingredients"]["Row"]>;
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          site_id: string | null;
          site_name: string;
          frequency: string;
          monthly_price: number;
          renewal_date: string | null;
          status: "active" | "ending_soon" | "ended";
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contracts"]["Row"]> & {
          workspace_id: string;
          site_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["contracts"]["Row"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          customer_id: string | null;
          name: string;
          project_type: "site" | "maintenance" | "other";
          status: "in_progress" | "maintenance" | "done";
          deadline: string | null;
          budget: number | null;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["projects"]["Row"]> & {
          workspace_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Row"]>;
        Relationships: [];
      };
      waste_log: {
        Row: {
          id: string;
          workspace_id: string;
          inventory_item_id: string | null;
          item_name: string;
          quantity: number;
          unit: string;
          reason: string;
          estimated_cost: number | null;
          logged_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["waste_log"]["Row"]> & {
          workspace_id: string;
          item_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["waste_log"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          workspace_id: string;
          prospect_id: string;
          type:
            | "added_to_crm"
            | "status_change"
            | "note"
            | "email_sent"
            | "followup_sent"
            | "reply_received"
            | "call_logged"
            | "google_verified"
            | "website_audited"
            | "appointment_created";
          detail: string;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          prospect_id: string;
          type: Database["public"]["Tables"]["activities"]["Row"]["type"];
          detail?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
        Relationships: [];
      };
      xp_events: {
        Row: {
          id: string;
          workspace_id: string;
          prospect_id: string | null;
          action: string;
          xp_amount: number;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          prospect_id?: string | null;
          action: string;
          xp_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["xp_events"]["Row"]>;
        Relationships: [];
      };
      usage_counters: {
        Row: {
          workspace_id: string;
          period_key: string;
          metric: "nova_requests" | "prospects_added" | "searches";
          count: number;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          period_key: string;
          metric: "nova_requests" | "prospects_added" | "searches";
          count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["usage_counters"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_usage: {
        Args: { p_workspace_id: string; p_period_key: string; p_metric: string; p_amount?: number };
        Returns: number;
      };
      complete_onboarding: {
        Args: {
          p_company_name: string;
          p_website: string | null;
          p_offer_description: string;
          p_audience: string;
          p_own_category_id: string | null;
          p_street: string;
          p_postal_code: string;
          p_city: string;
          p_lat: number;
          p_lng: number;
          p_target_category_ids: string[];
          p_radius_km?: number | null;
          p_product_mode?: string;
        };
        Returns: string;
      };
      award_xp: {
        Args: {
          p_workspace_id: string;
          p_action: string;
          p_amount: number;
          p_prospect_id?: string | null;
          p_dedupe?: boolean;
        };
        Returns: boolean;
      };
      is_workspace_member: { Args: { target_workspace_id: string }; Returns: boolean };
    };
  };
}

export type BusinessCategory = Database["public"]["Tables"]["business_categories"]["Row"];
export type BusinessProfile = Database["public"]["Tables"]["business_profiles"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Prospect = Database["public"]["Tables"]["prospects"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
export type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type RepairOrder = Database["public"]["Tables"]["repair_orders"]["Row"];
export type Contract = Database["public"]["Tables"]["contracts"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type WasteLogEntry = Database["public"]["Tables"]["waste_log"]["Row"];
export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];
export type Supplier = Database["public"]["Tables"]["suppliers"]["Row"];
export type Part = Database["public"]["Tables"]["parts"]["Row"];
export type RepairOrderPart = Database["public"]["Tables"]["repair_order_parts"]["Row"];
export type BusinessDocument = Database["public"]["Tables"]["documents"]["Row"];
export type ClientSite = Database["public"]["Tables"]["client_sites"]["Row"];
export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Site = Database["public"]["Tables"]["sites"]["Row"];
export type Intervention = Database["public"]["Tables"]["interventions"]["Row"];
export type Incident = Database["public"]["Tables"]["incidents"]["Row"];
export type PurchaseOrder = Database["public"]["Tables"]["purchase_orders"]["Row"];
export type PurchaseOrderItem = Database["public"]["Tables"]["purchase_order_items"]["Row"];
export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredient = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
