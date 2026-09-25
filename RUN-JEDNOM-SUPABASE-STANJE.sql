-- PILI CENTRALNI MAGACIN
-- PRAVILO STANJA:
--   ULAZ ROBE = DODAJE na cm_stock.qty centralnog magacina
--   SLANJE TREBOVANJA = NE MENJA stanje
--   POTVRDA MAGACIONERA = ODUZIMA iz centralnog magacina i DODAJE prodavnici
-- Pokrenuti JEDNOM u Supabase SQL Editoru.

create or replace function public.cm_create_transfer(
  p_user_id uuid,
  p_destination_id uuid,
  p_lines jsonb,
  p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  d uuid;
  x jsonb;
  central uuid;
  q numeric;
  cur numeric;
  a public.cm_articles%rowtype;
  req_status text;
begin
  select id into central
  from public.cm_locations
  where type='CENTRAL'
  limit 1;

  if central is null then
    raise exception 'Centralni magacin nije pronađen';
  end if;

  -- Zaključaj trebovanje i spreči duplo skidanje stanja.
  if p_request_id is not null then
    select status into req_status
    from public.cm_documents
    where id=p_request_id and type='TREBOVANJE'
    for update;

    if req_status is null then
      raise exception 'Trebovanje nije pronađeno';
    end if;

    if upper(req_status) in ('POSLATO','PRIMLJENO','ZAVRSENO') then
      raise exception 'Trebovanje je već završeno. Stanje nije ponovo promenjeno.';
    end if;
  end if;

  insert into public.cm_documents(
    type,status,source_location_id,destination_location_id,created_by
  )
  values('PRENOS','POSLATO',central,p_destination_id,p_user_id)
  returning id into d;

  for x in select * from jsonb_array_elements(p_lines) loop
    q := coalesce((x->>'qty')::numeric,0);
    if q <= 0 then
      continue;
    end if;

    select * into a
    from public.cm_articles
    where id=(x->>'article_id')::uuid;

    if a.id is null then
      raise exception 'Artikal nije pronađen';
    end if;

    select qty into cur
    from public.cm_stock
    where location_id=central and article_id=a.id
    for update;

    cur := coalesce(cur,0);

    if cur < q then
      raise exception 'Nema dovoljno robe za %. Na stanju: %, traženo: %', a.naziv, cur, q;
    end if;

    -- CENTRALNI MAGACIN: potvrđeno trebovanje ODUZIMA stanje.
    update public.cm_stock
    set qty = qty - q,
        updated_at = now()
    where location_id=central and article_id=a.id;

    -- PRODAVNICA: ista potvrđena količina se DODAJE na njeno stanje.
    insert into public.cm_stock(location_id,article_id,qty,updated_at)
    values(p_destination_id,a.id,q,now())
    on conflict(location_id,article_id)
    do update set
      qty = public.cm_stock.qty + excluded.qty,
      updated_at = now();

    insert into public.cm_document_lines(
      document_id,article_id,sifra,naziv,barkod,jm,qty,price
    )
    values(
      d,a.id,a.sifra,a.naziv,a.barkod,a.jm,q,a.maloprodajna_cena
    );
  end loop;

  if p_request_id is not null then
    update public.cm_documents
    set status='POSLATO',
        updated_at=now(),
        created_by=coalesce(created_by,p_user_id)
    where id=p_request_id and type='TREBOVANJE';
  end if;

  return d;
end;
$$;

-- Brza kontrola da funkcija postoji posle RUN-a.
select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name='cm_create_transfer';
