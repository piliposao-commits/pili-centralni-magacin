PILI CENTRALNI MAGACIN — ISPRAVKA POGREŠNO OČITANIH ŠIFARA

Pogrešno -> ispravno:
26888 -> 26996
26849 -> 22849
12884 -> 12954
12885 -> 12955
29994 -> 26994

ŠTA URADITI:
1. U Supabase SQL Editor pokreni RUN-JEDNOM-ISPRAVI-POGRESNE-SIFRE.sql
2. Zatim zameni projekat ovim ZIP-om i uradi git add / commit / push.

ŠTA JE DODATO:
- Stari ulazi sa pogrešnim šiframa prebacuju se na pravi artikal.
- Pogrešno otvoreni artikli se brišu.
- Stanje se spaja na pravi artikal bez gubitka količine.
- U staroj kalkulaciji, posle šifre 1234, sada možeš menjati i ŠIFRU (ne samo količinu/cenu).
- Nova šifra mora već postojati, da se slučajno ne otvori novi duplikat.
- AI čitanje automatski ispravlja ovih 5 poznatih OCR grešaka ako ih ponovo pročita.
