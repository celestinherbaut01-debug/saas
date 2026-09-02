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
          plan: "starter" | "pro" | "max";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_by: string;
          plan?: "starter" | "pro" | "max";
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type BusinessCategory = Database["public"]["Tables"]["business_categories"]["Row"];
export type BusinessProfile = Database["public"]["Tables"]["business_profiles"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
