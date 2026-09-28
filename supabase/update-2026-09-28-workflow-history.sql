create table if not exists public.cm_inventory_history(
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.cm_articles(id) on delete cascade,
  qty numeric(16,3) not null,
  counted_by text,
  counted_by_user_id uuid references public.cm_users(id),
  created_at timestamptz not null default now()
);

create index if not exists cm_inventory_history_article_created_idx
  on public.cm_inventory_history(article_id, created_at desc);

create or replace function public.cm_set_request_status(
  p_request_id uuid,
  p_status text,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=public,extensions
as $$
begin
  if p_status not in ('NOVO','U PRIPREMI','POSLATO','PRIMLJENO') then
    raise exception 'Neispravan status';
  end if;

  update public.cm_documents
  set status=p_status,
      updated_at=now(),
      created_by=coalesce(created_by,p_user_id)
  where id=p_request_id
    and type='TREBOVANJE';

  return found;
end
$$;
