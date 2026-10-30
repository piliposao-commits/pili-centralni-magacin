-- PILI CENTRALNI MAGACIN -> TS MARKET
-- Pokrenuti JEDNOM u Supabase SQL Editor-u pre ukljucivanja integracije.

alter table public.cm_locations
  add column if not exists ts_market_warehouse_code text;

-- Centralni magacin u TS Marketu je oznaka 20.
update public.cm_locations
set ts_market_warehouse_code = '20'
where type = 'CENTRAL';

create table if not exists public.ts_market_movements (
  movement_id text not null,
  revision integer not null default 1,
  occurred_at timestamptz not null default now(),
  pili_store_code text not null,
  ts_market_warehouse_code text,
  kind text not null,
  pili_article_id uuid not null references public.cm_articles(id),
  pili_sifra text not null,
  item_name text not null,
  unit text not null default 'KOM',
  quantity numeric(16,3) not null check (quantity > 0),
  from_warehouse_code text not null default '20',
  to_warehouse_code text,
  source_record_id uuid references public.cm_documents(id) on delete cascade,
  test boolean not null default false,
  status text not null default 'READY' check (status in ('READY','POSTED','REJECTED')),
  ts_market_document_id text,
  posted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (movement_id, revision)
);

create index if not exists ts_market_movements_status_created_idx
  on public.ts_market_movements(status, created_at);
create index if not exists ts_market_movements_source_idx
  on public.ts_market_movements(source_record_id);

-- Primer mapiranja. Ako TS Market koristi druge sifre magacina/prodavnica,
-- promeni SAMO desnu vrednost u ovom UPDATE-u. PILI sifre ostaju iste.
-- update public.cm_locations set ts_market_warehouse_code='101' where code='PILI1';
-- update public.cm_locations set ts_market_warehouse_code='102' where code='PILI2';
-- update public.cm_locations set ts_market_warehouse_code='103' where code='PILIPLUS';
-- update public.cm_locations set ts_market_warehouse_code='104' where code='BECMEN';
-- update public.cm_locations set ts_market_warehouse_code='105' where code='BOLJEVCI';
