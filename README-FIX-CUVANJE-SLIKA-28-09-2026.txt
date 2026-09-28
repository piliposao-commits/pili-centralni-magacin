PILI CENTRALNI MAGACIN — FIX ČUVANJE SLIKA

Problem:
Kod čuvanja slike artikla pojavljivao se FORBIDDEN.

Ispravka:
- upload slike sada proverava stvarnu prijavljenu sesiju
- dozvoljen je ADMIN
- dozvoljen je MAGACIONER
- PRODAVNICA i dalje nema pravo da menja sliku artikla
- postojeća logika čuvanja u Supabase Storage ostaje ista

Ne treba SQL.
