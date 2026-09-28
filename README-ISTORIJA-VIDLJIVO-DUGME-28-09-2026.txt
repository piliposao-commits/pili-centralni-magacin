PILI CENTRALNI MAGACIN — ISPRAVKA 28.09.2026

OVO JE ISPRAVLJENO:
1. U ADMIN -> POČETNO STANJE svaki artikal sada ima veliko plavo dugme:
   "ISTORIJA KRETANJA ROBE".
2. U ADMIN -> STANJE / VREDNOST postoji posebna kolona "Istorija"
   i dugme "OTVORI ISTORIJU" za svaki artikal.
3. Klik otvara prozor sa:
   - datumom,
   - ulazima,
   - trebovanjima/izlazima,
   - prodavnicom/statusom,
   - popisima kada postoje.
4. Ako SQL tabela za istoriju popisa još nije napravljena,
   istorija ulaza i izlaza i dalje radi.
5. U vrhu aplikacije mora da piše:
   "VERZIJA 28.09 ISTORIJA"
   da možeš odmah da vidiš da je nova verzija zaista deployovana.

Ako želiš i istoriju POPISA, pokreni jednom:
supabase/update-2026-09-28-workflow-history.sql
