PILI CENTRALNI MAGACIN — KOMPLET 28.09.2026

1) LOGIKA STANJA
- Početno stanje = 0.
- Ulaz robe povećava stanje.
- Za trebovanja se računa prvo prihvaćeno trebovanje od 25.09.2026 09:24:08 UTC i sva naredna.
- Starija trebovanja pre tog preseka se ne oduzimaju.
- Svako novo trebovanje od tog preseka odmah rezerviše/skida traženu količinu.
- Ako magacioner pri pakovanju smanji količinu, stanje se automatski preračuna prema stvarno spakovanoj količini.

2) TOK TREBOVANJA / NOTIFIKACIJE
RADNJA -> NOVO
- Radnik pošalje trebovanje.
- Magacioner vidi novo trebovanje i dobija notifikaciju ako su notifikacije uključene.

MAGACIONER -> U PRIPREMI -> POSLATO
- Otvaranjem prelazi u U PRIPREMI.
- Magacioner čekira artikle i može da ispravi količinu.
- Klikom "ROBA SPAKOVANA / POŠALJI ADMINU" trebovanje prelazi u POSLATO.
- Admin tek tada vidi trebovanje kao "ČEKA KNJIŽENJE" i dobija notifikaciju.

ADMIN -> PRIMLJENO
- Admin klikne PROKNJIŽI ili PROKNJIŽI / SAČUVAJ PDF.
- Status prelazi u PRIMLJENO (proknjiženo).
- Knjiženje ne skida robu drugi put.

3) ISTORIJA ARTIKLA
Admin -> Stanje / vrednost -> klik na NAZIV artikla.
Prikazuje:
- sve ulaze robe sa datumom,
- sva trebovanja/izlaze sa datumom, prodavnicom i statusom,
- popise sa datumom i stanjem,
- filtere Sve / Ulazi / Izlazi / Popisi,
- zbir ulaza, trebovanja i poslednji popis.

4) SQL — POKRENUTI JEDNOM
U Supabase SQL Editor pokrenuti:
supabase/update-2026-09-28-workflow-history.sql

Ovaj SQL samo dodaje istoriju popisa i osigurava statuse trebovanja.
Ne briše postojeću robu, ulaze, artikle ni trebovanja.

NAPOMENA:
Stari popisi iz verzija koje ranije nisu čuvale datum popisa ne mogu se retroaktivno rekonstruisati.
Od ove verzije svaki novi popis se trajno beleži sa datumom i korisnikom.
