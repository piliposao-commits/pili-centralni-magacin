PILI CENTRALNI MAGACIN — PRIHVACENA TREBOVANJA

Pravilo:
1. Pocetno stanje = 0.
2. Ulaz robe povecava stanje.
3. NOVO / U PRIPREMI ne oduzima stanje.
4. Kada magacioner zavrsi pakovanje, pravi se PRENOS i zahtev dobija status POSLATO.
5. Zavrseni PRENOS oduzima stanje po stvarno spakovanim kolicinama.
6. Za staru istoriju: ako je zahtev oznacen POSLATO/PRIMLJENO/ZAVRSENO, ali stara verzija nije napravila PRENOS,
   zahtev se koristi kao fallback. Ako PRENOS postoji, ne oduzima se dva puta.

VAZNO ZA PRETHODNO PILI PLUS TREBOVANJE:
- Pokrenuti jednom RUN-JEDNOM-PRIHVATI-PRETHODNO-PILI-PLUS.sql u Supabase SQL Editor-u.
- Posle toga osveziti aplikaciju (Ctrl+F5).
