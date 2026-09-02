// Config publique : l'URL Supabase et la clé "anon" sont faites pour être
// exposées côté client (c'est Row Level Security, pas le secret de la clé,
// qui protège les données — voir supabase/migrations/0001_init_schema.sql).
// Remplacez ces deux valeurs par celles de votre projet Supabase
// (Project Settings → API).
export const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
