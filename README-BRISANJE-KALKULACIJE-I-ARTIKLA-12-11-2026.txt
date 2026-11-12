PILI CENTRALNI MAGACIN — BRISANJE KALKULACIJE I ARTIKLA
12.11.2026.

1) ADMIN > ULAZ ROBE > PRETHODNI ULAZI
- Otvori kalkulaciju.
- Dugme: OBRIŠI CELU KALKULACIJU.
- Potvrda šifrom 1234.
- Briše dokument i njegove stavke.
- Stanje centralnog magacina se odmah preračunava iz preostalih dokumenata.
- Artikli koji su postojali SAMO na toj kalkulaciji i nemaju drugu istoriju automatski se brišu iz šifarnika.
- Artikal koji postoji na drugim ulazima/izlazima/popisu/TS Marketu ostaje, jer njegovo fizičko brisanje bi pokvarilo istoriju.

2) ADMIN > STANJE
- Dodata kolona BRISANJE i dugme OBRIŠI ARTIKAL.
- Potvrda šifrom 1234.
- Artikal može fizički da se obriše samo ako nema dokumente, popis, TS Market kretanje i nema stanje.
- Ako ima istoriju, aplikacija objašnjava šta prvo treba obrisati/ispraviti.

Novi SQL nije potreban.
