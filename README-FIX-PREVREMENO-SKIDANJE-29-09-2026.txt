PILI CENTRALNI MAGACIN — ISPRAVKA PREVREMENOG SKIDANJA

PRAVILO:
1. Radnja pošalje trebovanje -> stanje centralnog magacina SE NE MENJA.
2. Magacioner otvori trebovanje / status U PRIPREMI -> stanje SE NE MENJA.
3. Čekiranje stavki samo označava šta je spakovano -> stanje SE NE MENJA.
4. Kada magacioner potvrdi ROBA SPAKOVANA / POŠALJI ADMINU, status postaje POSLATO i tek tada se stvarno spakovana količina knjiži kao izlaz.
5. Ako magacioner ispravi količinu, knjiži se ispravljena/spakovana količina.
6. Admin knjiženje PRIMLJENO ne skida robu drugi put.

Istorija artikla:
- NOVO / U PRIPREMI se prikazuje kao ČEKA PAKOVANJE i ne ulazi u UKUPNO TREBOVANO.
- POSLATO / PRIMLJENO / ZAVRSENO ulazi u stvarni izlaz.

Nije potreban novi SQL za ovu aplikacionu ispravku.
