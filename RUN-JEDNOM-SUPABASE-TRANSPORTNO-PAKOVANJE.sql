-- PILI CENTRALNI MAGACIN — TRANSPORTNO PAKOVANJE / KUTIJE
-- Pokrenuti JEDNOM u Supabase > SQL Editor pre deploy-a.

alter table public.cm_articles
  add column if not exists transportno_pakovanje integer;

alter table public.cm_articles
  drop constraint if exists cm_articles_transportno_pakovanje_check;

alter table public.cm_articles
  add constraint cm_articles_transportno_pakovanje_check
  check (transportno_pakovanje is null or transportno_pakovanje > 0);

comment on column public.cm_articles.transportno_pakovanje is
  'Broj komada/jedinica u jednom transportnom pakovanju (kutiji).';
