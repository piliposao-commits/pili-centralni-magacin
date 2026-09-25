PILI CENTRALNI MAGACIN — PRAVILO STANJA

1. POCETNO STANJE ostaje sacuvano kao polazna vrednost.
2. ULAZ ROBE: dodaje kolicinu na TRENUTNO STANJE svakog artikla.
3. TREBOVANJE: samo slanje zahteva NE menja stanje.
4. Kada magacioner potvrdi/zavrsi trebovanje: poslata kolicina se ODUZIMA od CENTRALNOG MAGACINA za svaki artikal i DODAJE odredisnoj prodavnici.
5. Isto trebovanje ne moze da se knjizi dva puta.
6. API proverava stanje posle Supabase RPC poziva i sam koriguje centralno i odredisno stanje ako je u bazi ostala starija verzija funkcije.
