PILI CENTRALNI MAGACIN — ARHIVIRAJ TREBOVANJE

Dodato samo na verziju koju je korisnik poslao 30.10.2026.

- Ne menja kutije, unos kutija niti transportno pakovanje.
- Admin može da arhivira samo već proknjiženo trebovanje (status PRIMLJENO).
- Arhiviranje menja status u ZAVRSENO.
- ZAVRSENO je već knjižen status u postojećoj logici stanja, zato arhiviranje ne skida robu ponovo i ne vraća je na stanje.
- Arhivirana trebovanja su u posebnoj sklopivoj sekciji "Arhivirana trebovanja".
- Nije potreban novi SQL.

Deploy preko postojećeg GitHub repozitorijuma:
npm install
npm run build
git add .
git commit -m "Arhiviraj trebovanje"
git push
