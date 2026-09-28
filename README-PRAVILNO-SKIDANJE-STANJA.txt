PILI CENTRALNI MAGACIN — ISPRAVNA LOGIKA TREBOVANJA

RADNJA:
- napravi trebovanje
- stanje centralnog magacina se NE menja
- status NOVO

MAGACIONER:
- otvara trebovanje
- vidi stvarno trenutno stanje
- čekira/spakuje robu
- klikom na potvrdu pakovanja status ide na POSLATO
- TEK TADA se količina oduzima iz centralnog stanja

ADMIN:
- dobija trebovanje tek posle potvrde magacionera
- knjiženje ne sme drugi put da skine stanje

Primer šećer:
ulaz 200
prvo trebovanje 100 -> stanje ostaje 200 dok magacioner ne potvrdi
magacioner potvrdi -> stanje 100
drugo trebovanje 100 -> stanje ostaje 100 dok magacioner ne potvrdi
magacioner potvrdi -> stanje 0

Ne treba novi SQL.
