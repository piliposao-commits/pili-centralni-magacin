create extension if not exists pgcrypto with schema extensions;

create table if not exists cm_users(
 id uuid primary key default gen_random_uuid(),
 username text unique not null,
 full_name text not null,
 password_hash text not null,
 role text not null check(role in ('ADMIN','MAGACIONER','PRODAVNICA')),
 location_code text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists cm_locations(
 id uuid primary key default gen_random_uuid(),
 code text unique not null,
 name text not null,
 type text not null check(type in ('CENTRAL','STORE','WAREHOUSE')),
 active boolean not null default true
);

create table if not exists cm_articles(
 id uuid primary key default gen_random_uuid(),
 sifra text unique not null,
 naziv text not null,
 barkod text unique,
 jm text not null default 'KOM',
 maloprodajna_cena numeric(14,2) not null default 0,
 active boolean not null default true,
 updated_at timestamptz not null default now()
);

create table if not exists cm_stock(
 location_id uuid not null references cm_locations(id),
 article_id uuid not null references cm_articles(id),
 qty numeric(16,3) not null default 0,
 updated_at timestamptz not null default now(),
 primary key(location_id,article_id)
);

create table if not exists cm_documents(
 id uuid primary key default gen_random_uuid(),
 type text not null check(type in ('ULAZ','PRENOS','TREBOVANJE')),
 status text not null default 'ZAVRSENO',
 source_location_id uuid references cm_locations(id),
 destination_location_id uuid references cm_locations(id),
 requested_by text,
 document_no text,
 supplier text,
 created_by uuid references cm_users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists cm_document_lines(
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references cm_documents(id) on delete cascade,
 article_id uuid not null references cm_articles(id),
 sifra text not null,
 naziv text not null,
 barkod text,
 jm text not null,
 qty numeric(16,3) not null,
 price numeric(14,2) not null default 0
);

create index if not exists cm_doc_created_idx on cm_documents(created_at desc);
create index if not exists cm_doc_type_idx on cm_documents(type,status);

insert into cm_locations(code,name,type)
values ('CENTRAL','CENTRALNI MAGACIN','CENTRAL'),('PILI1','PILI 1','STORE'),('PILI2','PILI 2','STORE'),('PILIPLUS','PILI PLUS','STORE'),('BECMEN','PILI BEČMEN','STORE'),('BOLJEVCI','PILI BOLJEVCI','STORE')
on conflict(code) do nothing;

-- Primer naloga. PROMENI lozinke posle prvog ulaska.
insert into cm_users(username,full_name,password_hash,role)
values ('admin','Administrator',extensions.crypt('1111',extensions.gen_salt('bf')),'ADMIN'),('magacin','Magacioner',extensions.crypt('1111',extensions.gen_salt('bf')),'MAGACIONER')
on conflict(username) do nothing;

create or replace function cm_login(p_username text,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare u cm_users%rowtype;
begin
 select * into u from cm_users where lower(username)=lower(trim(p_username)) and active=true;
 if u.id is null or u.password_hash <> extensions.crypt(p_password,u.password_hash) then return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true,'user',jsonb_build_object('id',u.id,'username',u.username,'full_name',u.full_name,'role',u.role));
end $$;

create or replace view cm_stock_view as
select a.id article_id,a.sifra,a.naziv,a.barkod,a.jm,coalesce(s.qty,0)::numeric(16,3) stanje,a.maloprodajna_cena,(coalesce(s.qty,0)*a.maloprodajna_cena)::numeric(16,2) vrednost
from cm_articles a
cross join (select id from cm_locations where type='CENTRAL' limit 1) c
left join cm_stock s on s.article_id=a.id and s.location_id=c.id
where a.active=true;

create or replace view cm_requests_view as
select d.id,d.destination_location_id location_id,l.name location_name,d.requested_by,d.status,d.created_at,
 coalesce(jsonb_agg(jsonb_build_object('article_id',dl.article_id,'sifra',dl.sifra,'naziv',dl.naziv,'jm',dl.jm,'qty',dl.qty) order by dl.naziv) filter(where dl.id is not null),'[]'::jsonb) lines
from cm_documents d
join cm_locations l on l.id=d.destination_location_id
left join cm_document_lines dl on dl.document_id=d.id
where d.type='TREBOVANJE'
group by d.id,l.name;

create or replace function cm_create_inbound(p_user_id uuid,p_document_no text,p_supplier text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare d uuid; x jsonb; a uuid; central uuid; q numeric; price numeric;
begin
 select id into central from cm_locations where type='CENTRAL' limit 1;
 insert into cm_documents(type,status,destination_location_id,document_no,supplier,created_by) values('ULAZ','ZAVRSENO',central,p_document_no,p_supplier,p_user_id) returning id into d;
 for x in select * from jsonb_array_elements(p_lines) loop
  q:=coalesce((x->>'kolicina')::numeric,0); price:=coalesce((x->>'maloprodajna_cena')::numeric,0);
  if q<=0 or coalesce(x->>'sifra','')='' then continue; end if;
  insert into cm_articles(sifra,naziv,barkod,jm,maloprodajna_cena,updated_at)
  values(x->>'sifra',coalesce(nullif(x->>'naziv',''),x->>'sifra'),nullif(x->>'barkod',''),coalesce(nullif(x->>'jm',''),'KOM'),price,now())
  on conflict(sifra) do update set naziv=excluded.naziv,barkod=coalesce(excluded.barkod,cm_articles.barkod),jm=excluded.jm,maloprodajna_cena=case when excluded.maloprodajna_cena>0 then excluded.maloprodajna_cena else cm_articles.maloprodajna_cena end,updated_at=now()
  returning id into a;
  insert into cm_stock(location_id,article_id,qty) values(central,a,q) on conflict(location_id,article_id) do update set qty=cm_stock.qty+excluded.qty,updated_at=now();
  insert into cm_document_lines(document_id,article_id,sifra,naziv,barkod,jm,qty,price) select d,id,sifra,naziv,barkod,jm,q,maloprodajna_cena from cm_articles where id=a;
 end loop;
 return d;
end $$;

create or replace function cm_create_transfer(p_user_id uuid,p_destination_id uuid,p_lines jsonb,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare d uuid; x jsonb; central uuid; q numeric; cur numeric; a cm_articles%rowtype;
begin
 select id into central from cm_locations where type='CENTRAL' limit 1;
 insert into cm_documents(type,status,source_location_id,destination_location_id,created_by) values('PRENOS','POSLATO',central,p_destination_id,p_user_id) returning id into d;
 for x in select * from jsonb_array_elements(p_lines) loop
  q:=(x->>'qty')::numeric; select * into a from cm_articles where id=(x->>'article_id')::uuid;
  select coalesce(qty,0) into cur from cm_stock where location_id=central and article_id=a.id for update;
  if q<=0 or cur<q then raise exception 'Nema dovoljno robe za %. Na stanju: %',a.naziv,coalesce(cur,0); end if;
  update cm_stock set qty=qty-q,updated_at=now() where location_id=central and article_id=a.id;
  insert into cm_stock(location_id,article_id,qty) values(p_destination_id,a.id,q) on conflict(location_id,article_id) do update set qty=cm_stock.qty+excluded.qty,updated_at=now();
  insert into cm_document_lines(document_id,article_id,sifra,naziv,barkod,jm,qty,price) values(d,a.id,a.sifra,a.naziv,a.barkod,a.jm,q,a.maloprodajna_cena);
 end loop;
 if p_request_id is not null then update cm_documents set status='POSLATO',updated_at=now() where id=p_request_id and type='TREBOVANJE'; end if;
 return d;
end $$;

create or replace function cm_create_request(p_location_id uuid,p_requested_by text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare d uuid; x jsonb; a cm_articles%rowtype; q numeric;
begin
 insert into cm_documents(type,status,destination_location_id,requested_by) values('TREBOVANJE','NOVO',p_location_id,p_requested_by) returning id into d;
 for x in select * from jsonb_array_elements(p_lines) loop
  q:=(x->>'qty')::numeric; if q<=0 then continue; end if;
  select * into a from cm_articles where id=(x->>'article_id')::uuid;
  insert into cm_document_lines(document_id,article_id,sifra,naziv,barkod,jm,qty,price) values(d,a.id,a.sifra,a.naziv,a.barkod,a.jm,q,0);
 end loop;
 return d;
end $$;

create or replace function cm_set_request_status(p_request_id uuid,p_status text,p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
 if p_status not in ('NOVO','U PRIPREMI','POSLATO','PRIMLJENO') then raise exception 'Neispravan status'; end if;
 update cm_documents set status=p_status,updated_at=now(),created_by=coalesce(created_by,p_user_id) where id=p_request_id and type='TREBOVANJE';
 return found;
end $$;


-- Korisnici za poseban /trebovanje link
insert into cm_users(username,full_name,password_hash,role,active,location_code)
values
 ('mijatovic.olivera','Mijatović Olivera',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BOLJEVCI'),
 ('popovic.milena','Popović Milena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null),
 ('cumic.jelena','Ćumić Jelena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'PILI2'),
 ('belic.biljana','Belić Biljana',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BECMEN'),
 ('ivkovic.sonja','Ivković Sonja',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null),
 ('stankovic.jelena','Stanković Jelena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null)
on conflict(username) do nothing;
