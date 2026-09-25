# PILI — Centralni magacin

Ovo je početna kompletna verzija aplikacije za centralni magacin.

## Šta radi
- Login za ADMIN / MAGACIONER.
- Glavni tok za magacionera: izbor prodavnice -> dodavanje artikala -> količina -> ZAVRŠI PRENOS.
- Ne dozvoljava izlaz veći od raspoloživog stanja.
- Trebovanja iz prodavnica na posebnom linku `/trebovanje`.
- Šef prodavnice vidi trenutno raspoložive količine, ali ne cene.
- Admin ulaz robe kamerom/slikom kalkulacije.
- Sa kalkulacije se čita: šifra, naziv, barkod, JM, količina i Malopr. cena.
- Pre knjiženja admin dobija pregled i može ručno da ispravi svaku stavku.
- Admin vidi stanje, maloprodajnu cenu i ukupnu vrednost centralnog magacina.
- Trebovanje može da pređe u prenos i tada se stanje automatski skida iz centralnog magacina.

## 1. Supabase
U SQL editoru pokreni ceo fajl:
`supabase/centralni-magacin.sql`

Početni korisnici:
- admin / 1111
- magacin / 1111

Promeni ih posle prvog testa.

## 2. Vercel Environment Variables
Dodaj:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`  (NE stavljati NEXT_PUBLIC)
- `OPENAI_API_KEY`
- `SESSION_SECRET`

## 3. Logo
U `public` ubaci postojeći PILI logo pod imenom:
`pili-logo.png`

## 4. Linkovi
- Glavna aplikacija: `/`
- Trebovanje prodavnica: `/trebovanje`

## 5. Važno
Za OCR je korišćen OpenAI Responses API i model `gpt-5.6-luna` sa image inputom. Fotografija se prvo analizira, a knjiženje se izvršava tek nakon admin potvrde.

Ovo je MVP osnova. Za strožu produkcionu bezbednost sledeći korak je vezivanje svakog korisnika za Supabase Auth ili dodatni server-side audit token po sesiji.
