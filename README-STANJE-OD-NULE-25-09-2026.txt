PILI CENTRALNI MAGACIN — LOGIKA STANJA

POČETNO STANJE SVIH ARTIKALA = 0

TRENUTNO STANJE = UKUPNO ULAZA ROBE - UKUPNO POTVRĐENIH IZLAZA/TREBOVANJA

- Kreirano trebovanje NE skida stanje.
- Otvoreno/U pripremi trebovanje NE skida stanje.
- Tek kada magacioner potvrdi i završi trebovanje, nastaje PRENOS i roba se skida iz centralnog magacina.
- Isto trebovanje ne može dva puta da skine robu.
- Ulaz robe uvek dodaje količinu.
- Početno stanje više nije ručno promenljivo; zaključano je na 0.
- U admin delu Početno stanje prikazuje: 0 / ukupno ušlo / potvrđeno izašlo / izračunato trenutno stanje.

Za ovu izmenu nije potreban novi SQL.
