-- PILI Trebovanje korisnici - ispravka 25.09.2026
-- Ispravka korisnika Biljane i dodavanje Jelene Stanković.

-- Ako postoji stari pogrešan username, promeni ga bez gubitka veze sa lokacijom.
update cm_users
set username = 'belic.biljana',
    full_name = 'Belić Biljana',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true
where lower(username) = 'bjelic.biljana'
  and not exists (select 1 from cm_users u2 where lower(u2.username) = 'belic.biljana');

-- Ako novi username već postoji, samo osveži podatke.
update cm_users
set full_name = 'Belić Biljana',
    password_hash = extensions.crypt('1234', extensions.gen_salt('bf')),
    role = 'PRODAVNICA',
    active = true
where lower(username) = 'belic.biljana';

-- Dodaj Biljanu ako ne postoji. BECMEN veza ostaje podrazumevana.
insert into cm_users(username, full_name, password_hash, role, active, location_code)
select 'belic.biljana','Belić Biljana',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,'BECMEN'
where not exists (select 1 from cm_users where lower(username)='belic.biljana');

-- Dodaj Jelenu Stanković. Lokaciju bira prvi put na /trebovanje.
insert into cm_users(username, full_name, password_hash, role, active, location_code)
select 'stankovic.jelena','Stanković Jelena',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null
where not exists (select 1 from cm_users where lower(username)='stankovic.jelena');

-- Sonja ostaje aktivna sa šifrom 1234.
update cm_users
set full_name='Ivković Sonja',
    password_hash=extensions.crypt('1234',extensions.gen_salt('bf')),
    role='PRODAVNICA',
    active=true
where lower(username)='ivkovic.sonja';

insert into cm_users(username, full_name, password_hash, role, active, location_code)
select 'ivkovic.sonja','Ivković Sonja',extensions.crypt('1234',extensions.gen_salt('bf')),'PRODAVNICA',true,null
where not exists (select 1 from cm_users where lower(username)='ivkovic.sonja');
