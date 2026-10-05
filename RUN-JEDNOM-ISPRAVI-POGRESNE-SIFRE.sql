-- PILI CENTRALNI MAGACIN
-- ISPRAVKA POGREŠNO PROČITANIH ŠIFARA IZ STARIH KALKULACIJA
-- Datum: 2026-10-05
--
-- Pogrešno -> ispravno:
-- 26888 -> 26996
-- 26849 -> 22849
-- 12884 -> 12954
-- 12885 -> 12955
-- 29994 -> 26994
--
-- Skripta:
-- 1) prebacuje sve istorijske stavke sa pogrešnog artikla na pravi artikal,
-- 2) prebacuje eventualnu istoriju popisa,
-- 3) sabira trenutno stanje pogrešnog artikla u pravi artikal,
-- 4) briše pogrešno otvoreni artikal,
-- 5) ispravlja tekst šifre/naziva/barkoda/JM u starim dokumentima.
--
-- Može se pokrenuti jednom u Supabase SQL Editor-u.

begin;

do $$
declare
  m record;
  old_a public.cm_articles%rowtype;
  new_a public.cm_articles%rowtype;
  loc record;
  old_qty numeric;
  new_qty numeric;
begin
  for m in
    select * from (values
      ('26888','26996'),
      ('26849','22849'),
      ('12884','12954'),
      ('12885','12955'),
      ('29994','26994')
    ) as t(wrong_code, correct_code)
  loop
    select * into old_a from public.cm_articles where sifra = m.wrong_code;
    if old_a.id is null then
      raise notice 'Pogrešna šifra % ne postoji - preskačem.', m.wrong_code;
      continue;
    end if;

    select * into new_a from public.cm_articles where sifra = m.correct_code;

    -- Ako pravi artikal ne postoji, samo preimenuj pogrešno otvoreni artikal.
    if new_a.id is null then
      update public.cm_articles
      set sifra = m.correct_code,
          updated_at = now()
      where id = old_a.id;

      update public.cm_document_lines
      set sifra = m.correct_code
      where article_id = old_a.id;

      raise notice 'Šifra % je preimenovana u % jer pravi artikal nije postojao.', m.wrong_code, m.correct_code;
      continue;
    end if;

    -- Sve istorijske linije prebacujemo na postojeći pravi artikal.
    update public.cm_document_lines
    set article_id = new_a.id,
        sifra = new_a.sifra,
        naziv = new_a.naziv,
        barkod = new_a.barkod,
        jm = new_a.jm
    where article_id = old_a.id
       or sifra = m.wrong_code;

    -- Eventualni popisi / istorija artikla.
    if to_regclass('public.cm_inventory_history') is not null then
      update public.cm_inventory_history
      set article_id = new_a.id
      where article_id = old_a.id;
    end if;

    -- Spoji trenutno stanje po svim lokacijama, pa ukloni stari red stanja.
    for loc in select id from public.cm_locations loop
      select coalesce(qty,0) into old_qty
      from public.cm_stock
      where location_id = loc.id and article_id = old_a.id;

      select coalesce(qty,0) into new_qty
      from public.cm_stock
      where location_id = loc.id and article_id = new_a.id;

      if coalesce(old_qty,0) <> 0 then
        insert into public.cm_stock(location_id, article_id, qty, updated_at)
        values(loc.id, new_a.id, coalesce(new_qty,0) + coalesce(old_qty,0), now())
        on conflict(location_id,article_id)
        do update set qty = excluded.qty, updated_at = now();
      end if;

      delete from public.cm_stock
      where location_id = loc.id and article_id = old_a.id;
    end loop;

    -- Pogrešno otvoreni artikal više nema reference i može da se obriše.
    delete from public.cm_articles where id = old_a.id;

    raise notice 'Ispravljeno: % -> %', m.wrong_code, m.correct_code;
  end loop;
end $$;

commit;

-- PROVERA: ovo treba da vrati samo PRAVE šifre.
select sifra, naziv, barkod, active
from public.cm_articles
where sifra in ('26888','26996','26849','22849','12884','12954','12885','12955','29994','26994')
order by sifra;

-- PROVERA: ove pogrešne šifre više ne smeju da postoje u istorijskim linijama.
select sifra, count(*) as broj_stavki
from public.cm_document_lines
where sifra in ('26888','26849','12884','12885','29994')
group by sifra
order by sifra;
