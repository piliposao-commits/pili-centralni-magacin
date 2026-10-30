PILI CENTRALNI MAGACIN — TRANSPORTNO PAKOVANJE / KUTIJE (30.10.2026)

NOVO:
- ADMIN klikne na naziv artikla u STANJU i u prozoru istorije upisuje koliko komada ide u 1 transportno pakovanje.
- /trebovanje prikazuje stanje u komadima i kutijama.
- Prodavnica može da unese količinu direktno u KOMADIMA ili u KUTIJAMA.
- Dugme +1 KUTIJA brzo dodaje celo transportno pakovanje.
- Sistem i dalje knjiži osnovnu količinu (komade); kutije su preračun i ne mogu duplo da skinu stanje.
- Magacioner, admin, pregled i štampa prikazuju količinu i broj kutija.

VAŽNO — PRVO SUPABASE:
1. Supabase > SQL Editor
2. Otvori fajl RUN-JEDNOM-SUPABASE-TRANSPORTNO-PAKOVANJE.sql
3. Kopiraj ceo sadržaj i klikni RUN.

ONDA DEPLOY:
npm install
npm run build
vercel --prod
