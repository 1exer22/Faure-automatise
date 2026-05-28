-- ═══════════════════════════════════════════════════════════════════
-- Faure Automatise — Setup Supabase pour le formulaire de leads
-- À exécuter dans : Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════════════════

-- 1. Table des leads
create table if not exists public.leads (
  id             uuid        primary key default gen_random_uuid(),
  first_name     text        not null,
  email          text        not null,
  phone          text,
  firm           text,
  plan_interest  text,
  user_agent     text,
  created_at     timestamptz not null default now()
);

-- Si la table existait déjà (avant ajout de plan_interest), ajoute la colonne
alter table public.leads add column if not exists plan_interest text;

-- Index pour requêtes admin (tri par date, recherche par email)
create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_idx      on public.leads (email);

-- 2. Activer Row Level Security (RLS)
alter table public.leads enable row level security;

-- 3. Policy : tout visiteur peut INSÉRER un lead (le formulaire public)
drop policy if exists "Anyone can submit a lead" on public.leads;
create policy "Anyone can submit a lead"
  on public.leads
  for insert
  to anon, authenticated
  with check (true);

-- 4. Pas de policy SELECT pour anon → personne ne peut lire la liste
--    Seul le service_role (côté serveur / dashboard) peut lire.

-- 5. Fonction publique : retourne UNIQUEMENT le total de leads
--    (permet d'afficher le compteur sans exposer les données)
create or replace function public.get_leads_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint from public.leads;
$$;

revoke all on function public.get_leads_count() from public;
grant execute on function public.get_leads_count() to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- Vérification
-- ═══════════════════════════════════════════════════════════════════
-- Test rapide :
--   select public.get_leads_count();   -- doit renvoyer 0 au début
--
-- Récupérer les leads (dans le SQL Editor, qui utilise service_role) :
--   select * from public.leads order by created_at desc;
-- ═══════════════════════════════════════════════════════════════════
