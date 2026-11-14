-- THE TOILET RATING — schéma Supabase
-- À exécuter en entier dans Supabase > SQL Editor > New query.
-- Les visiteurs peuvent uniquement envoyer une note via submit_rating().
-- Les lectures détaillées et suppressions sont réservées aux administrateurs.

create extension if not exists pgcrypto;

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 24),
  quality integer not null check (quality between 0 and 10),
  comfort integer not null check (comfort between 0 and 10),
  speed integer not null check (speed between 0 and 10),
  experience integer not null check (experience between 0 and 10),
  comment text check (comment is null or char_length(comment) <= 240),
  created_at timestamptz not null default now()
);

create index if not exists ratings_created_at_idx on public.ratings (created_at desc);
create index if not exists ratings_name_lower_idx on public.ratings (lower(name));

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.ratings enable row level security;
alter table public.admin_users enable row level security;

-- Cette fonction est SECURITY DEFINER pour vérifier la liste des administrateurs
-- sans rendre la table admin_users lisible publiquement.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins can manage ratings" on public.ratings;
create policy "admins can manage ratings"
on public.ratings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Aucun accès direct aux tables pour les visiteurs.
revoke all on public.ratings from anon, authenticated;
grant select, delete on public.ratings to authenticated;

revoke all on public.admin_users from anon, authenticated;

-- Envoi public d'une note : validation côté serveur + délai anti-spam basique
-- par surnom (45 secondes). Le visiteur ne peut pas lire les autres lignes.
create or replace function public.submit_rating(
  p_name text,
  p_quality integer,
  p_comfort integer,
  p_speed integer,
  p_experience integer,
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := trim(coalesce(p_name, ''));
  clean_comment text := nullif(trim(coalesce(p_comment, '')), '');
  new_id uuid;
begin
  if char_length(clean_name) < 2 or char_length(clean_name) > 24 then
    raise exception 'Le surnom doit contenir entre 2 et 24 caractères.';
  end if;
  if p_quality not between 0 and 10
     or p_comfort not between 0 and 10
     or p_speed not between 0 and 10
     or p_experience not between 0 and 10 then
    raise exception 'Chaque note doit être comprise entre 0 et 10.';
  end if;
  if clean_comment is not null and char_length(clean_comment) > 240 then
    raise exception 'Le commentaire est trop long (240 caractères maximum).';
  end if;

  if exists (
    select 1 from public.ratings
    where lower(name) = lower(clean_name)
      and created_at > now() - interval '45 seconds'
  ) then
    raise exception 'Il faut attendre 45 secondes avant de noter à nouveau avec ce surnom.';
  end if;

  insert into public.ratings (name, quality, comfort, speed, experience, comment)
  values (clean_name, p_quality, p_comfort, p_speed, p_experience, clean_comment)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_rating(text, integer, integer, integer, integer, text) from public;
grant execute on function public.submit_rating(text, integer, integer, integer, integer, text) to anon, authenticated;

-- Statistiques publiques limitées aux agrégats.
create or replace function public.get_public_stats()
returns table (
  total_visits bigint,
  avg_score numeric,
  participant_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(round(avg((quality + comfort + speed + experience)::numeric / 4), 1), 0),
    count(distinct lower(name))::bigint
  from public.ratings;
$$;

revoke all on function public.get_public_stats() from public;
grant execute on function public.get_public_stats() to anon, authenticated;

-- Classement de tous les surnoms, avec moyenne des 4 critères par passage.
create or replace function public.get_public_leaderboard()
returns table (
  name text,
  avg_score numeric,
  visits bigint,
  best_score numeric,
  last_visit timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    min(r.name) as name,
    round(avg((r.quality + r.comfort + r.speed + r.experience)::numeric / 4), 1) as avg_score,
    count(*)::bigint as visits,
    round(max((r.quality + r.comfort + r.speed + r.experience)::numeric / 4), 1) as best_score,
    max(r.created_at) as last_visit
  from public.ratings r
  group by lower(r.name)
  order by avg_score desc, visits desc, last_visit desc;
$$;

revoke all on function public.get_public_leaderboard() from public;
grant execute on function public.get_public_leaderboard() to anon, authenticated;

-- Les 8 derniers commentaires publics, sans identifiant technique.
create or replace function public.get_recent_reviews()
returns table (
  name text,
  quality integer,
  comfort integer,
  speed integer,
  experience integer,
  avg_score numeric,
  comment text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.name, r.quality, r.comfort, r.speed, r.experience,
    round((r.quality + r.comfort + r.speed + r.experience)::numeric / 4, 1),
    r.comment, r.created_at
  from public.ratings r
  where r.comment is not null and r.comment <> ''
  order by r.created_at desc
  limit 8;
$$;

revoke all on function public.get_recent_reviews() from public;
grant execute on function public.get_recent_reviews() to anon, authenticated;

-- Après avoir créé votre utilisateur dans Authentication > Users,
-- remplacez l'UUID ci-dessous par son ID puis exécutez :
-- insert into public.admin_users (user_id)
-- values ('UUID-DE-VOTRE-UTILISATEUR')
-- on conflict do nothing;
