-- PILI Centralni Magacin / Trebovanje
-- Ispravka korisnika + dozvola role PRODAVNICA
-- Pokrenuti JEDNOM u Supabase SQL Editor-u.

alter table public.cm_users
  drop constraint if exists cm_users_role_check;

alter table public.cm_users
  add constraint cm_users_role_check
  check (role in ('ADMIN','MAGACIONER','PRODAVNICA'));

-- Belić Biljana: preimenuj stari pogrešan nalog ako postoji.
update public.cm_users
set username = 'belic.biljana',
    full_name = 'Belić Biljana',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true
where lower(username) = 'bjelic.biljana'
  and not exists (
    select 1 from public.cm_users u2 where lower(u2.username) = 'belic.biljana'
  );

update public.cm_users
set full_name = 'Belić Biljana',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true,
    location_code = coalesce(location_code, 'BECMEN')
where lower(username) = 'belic.biljana';

insert into public.cm_users(username, full_name, password_hash, role, active, location_code)
select 'belic.biljana','Belić Biljana',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BECMEN'
where not exists (
  select 1 from public.cm_users where lower(username)='belic.biljana'
);

-- Stanković Jelena
update public.cm_users
set full_name = 'Stanković Jelena',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true
where lower(username) = 'stankovic.jelena';

insert into public.cm_users(username, full_name, password_hash, role, active, location_code)
select 'stankovic.jelena','Stanković Jelena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null
where not exists (
  select 1 from public.cm_users where lower(username)='stankovic.jelena'
);

-- Ivković Sonja
update public.cm_users
set full_name = 'Ivković Sonja',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true
where lower(username) = 'ivkovic.sonja';

insert into public.cm_users(username, full_name, password_hash, role, active, location_code)
select 'ivkovic.sonja','Ivković Sonja',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null
where not exists (
  select 1 from public.cm_users where lower(username)='ivkovic.sonja'
);
