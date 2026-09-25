PILI CENTRALNI MAGACIN - FIX STANJA 25.09.2026

Problem:
- Trebovanje se zavrsi, ali starija Supabase funkcija cm_create_transfer moze ostaviti centralno stanje nepromenjeno.
- Primer: secer 200 KOM, izdato 100 KOM, a centralno stanje i dalje 200 KOM.

Resenje u ovoj verziji:
- app/api/transfer/route.ts pamti stanje pre potvrde.
- Poziva postojeci Supabase RPC zbog dokumenta/prenosa.
- Posle RPC-a proverava stanje centralnog magacina.
- Ako RPC nije oduzeo robu, API automatski postavlja stanje na PRE - POSLATO.
- Ako je RPC vec ispravno oduzeo, ne oduzima ponovo.
- Za trebovanja postoji provera statusa da se isto trebovanje ne moze zavrsiti dva puta.

Ovo znaci da za ovu ispravku korisnik NE MORA rucno da pokrece SQL u Supabase-u.
