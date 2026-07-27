-- Torre de Controle WTA — Supabase schema v1
-- Rode isto no Supabase → SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.snapshot (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  source_file text,
  os_count    integer,
  faturamento numeric,
  payload     jsonb not null            -- DATA + F1 + COM já processados
);

create index if not exists snapshot_created_idx on public.snapshot (created_at desc);

alter table public.snapshot enable row level security;

-- Dashboard pode LER (mesmo nível do site público de hoje)
drop policy if exists "public read" on public.snapshot;
create policy "public read" on public.snapshot
  for select to anon, authenticated using (true);

-- Só quem está logado (você, no /admin) pode GRAVAR
drop policy if exists "auth insert" on public.snapshot;
create policy "auth insert" on public.snapshot
  for insert to authenticated with check (true);
