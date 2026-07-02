-- Rode este SQL somente se o Supabase recusar salvar o status "orcamento"
-- por causa de uma constraint/check antigo no campo status.

alter table public.af_service_orders
  drop constraint if exists af_service_orders_status_check;

alter table public.af_service_orders
  add constraint af_service_orders_status_check
  check (status in ('orcamento', 'aguardando', 'em_manutencao', 'finalizado'));
