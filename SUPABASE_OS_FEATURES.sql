-- Vortan Oficina - recursos novos da Ordem de Serviço
-- Rode este SQL uma vez no Supabase SQL Editor.

alter table if exists public.af_service_orders
  add column if not exists delivery_date date,
  add column if not exists checklist text default '';

create table if not exists public.af_order_photos (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.af_profiles(id) on delete cascade,
  order_id uuid not null references public.af_service_orders(id) on delete cascade,
  file_path text not null,
  public_url text not null,
  file_name text not null default '',
  photo_type text not null default 'geral' check (photo_type in ('antes', 'depois', 'geral')),
  created_at timestamptz not null default now()
);

alter table public.af_order_photos enable row level security;

drop policy if exists "order photos select own workshop" on public.af_order_photos;
create policy "order photos select own workshop"
  on public.af_order_photos for select
  using (auth.uid() = workshop_id);

drop policy if exists "order photos insert own workshop" on public.af_order_photos;
create policy "order photos insert own workshop"
  on public.af_order_photos for insert
  with check (auth.uid() = workshop_id);

drop policy if exists "order photos delete own workshop" on public.af_order_photos;
create policy "order photos delete own workshop"
  on public.af_order_photos for delete
  using (auth.uid() = workshop_id);

insert into storage.buckets (id, name, public)
values ('order-photos', 'order-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "order photos storage select" on storage.objects;
create policy "order photos storage select"
  on storage.objects for select
  using (bucket_id = 'order-photos');

drop policy if exists "order photos storage insert own folder" on storage.objects;
create policy "order photos storage insert own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'order-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "order photos storage delete own folder" on storage.objects;
create policy "order photos storage delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'order-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
