// Types manuels reflétant supabase/migrations/*.sql (Phase 1).
// À remplacer plus tard par `supabase gen types typescript` une fois un
// projet Supabase réel lié — voir README pour la commande.
//
// Chaque table doit inclure `Relationships` (même vide) : c'est une
// contrainte du générique `GenericTable` de @supabase/postgrest-js, sans
// quoi TypeScript retombe silencieusement sur `never` pour insert/update.

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
          plan: "free" | "starter" | "pro" | "max";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          plan?: "free" | "starter" | "pro" | "max";
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
          status: "new" | "to_contact" | "contacted" | "replied" | "won" | "lost";
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
          plan: "free" | "starter" | "pro" | "max";
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
          p_radius_km: number;
          p_target_category_ids: string[];
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
