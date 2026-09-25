-- PILI Centralni Magacin - update 24.09.2026
-- 1) dodaje ulogu PRODAVNICA
-- 2) dodaje location_code korisniku
-- 3) kreira korisnike za trebovanje sa sifrom 1234
-- 4) popravlja cm_login da koristi pgcrypto iz extensions sheme

create extension if not exists pgcrypto with schema extensions;

alter table cm_users add column if not exists location_code text;
alter table cm_users drop constraint if exists cm_users_role_check;
alter table cm_users add constraint cm_users_role_check check(role in ('ADMIN','MAGACIONER','PRODAVNICA'));

create or replace function cm_login(p_username text,p_password text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare u cm_users%rowtype;
begin
 select * into u from cm_users where lower(username)=lower(trim(p_username)) and active=true;
 if u.id is null or u.password_hash <> extensions.crypt(p_password,u.password_hash) then return jsonb_build_object('ok',false); end if;
 return jsonb_build_object('ok',true,'user',jsonb_build_object('id',u.id,'username',u.username,'full_name',u.full_name,'role',u.role));
end $$;

insert into cm_users(username,full_name,password_hash,role,active,location_code)
values
 ('mijatovic.olivera','Mijatović Olivera',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BOLJEVCI'),
 ('popovic.milena','Popović Milena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null),
 ('cumic.jelena','Ćumić Jelena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'PILI2'),
 ('bjelic.biljana','Bjelić Biljana',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BECMEN'),
 ('ivkovic.sonja','Ivković Sonja',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null)
on conflict(username) do update set
 full_name=excluded.full_name,
 password_hash=excluded.password_hash,
 role='PRODAVNICA',
 active=true,
 location_code=coalesce(cm_users.location_code,excluded.location_code);

-- Ostali korisnici koji nemaju location_code biraju svoju prodavnicu samo prvi put na /trebovanje.
