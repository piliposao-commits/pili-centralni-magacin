PILI CENTRALNI MAGACIN - UPDATE 24.09.2026

NOVO:
- Magacioner: broj NEOTVORENIH trebovanja se vidi na baneru.
- Svako NOVO trebovanje je posebno oznaceno kao NEOTVORENO.
- Kada magacioner otvori trebovanje, prelazi u U PRIPREMI i vise se ne racuna kao neotvoreno.
- Trebovanje moze normalno da se otvori i obradjuje.
- Admin: Trebovanja prikazuju broj neotvorenih.
- Admin moze da otvori svako trebovanje i vidi ceo spisak.
- Admin ima dugme STAMPAJ / SACUVAJ PDF (u browser Print prozoru izaberi Save as PDF).
- Kada magacioner izabere prodavnicu u Izlazu robe, ostale prodavnice se sklanjaju. Ostaje samo trenutna prodavnica + PROMENI PRODAVNICU.
- Poseban /trebovanje link ima korisnike prodavnica.
- Ako korisnik prodavnice jos nema dodeljenu prodavnicu, pri prvom ulasku bira je samo jednom.

KORISNICI ZA TREBOVANJE:
- mijatovic.olivera / 1234 (vec vezana za PILI BOLJEVCI)
- popovic.milena / 1234
- cumic.jelena / 1234
- belic.biljana / 1234
- ivkovic.sonja / 1234

VAZNO POSLE RASPAKIVANJA:
1. U Supabase -> SQL Editor pokreni ceo fajl:
   supabase/update-2026-09-24.sql
2. U PowerShell-u iz foldera projekta:
   npm install
   npm run build
3. Ako build prodje:
   vercel --prod

Trebovanje link:
https://pili-centralnii-magacin.vercel.app/trebovanje
