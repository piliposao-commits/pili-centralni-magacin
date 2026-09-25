PILI CENTRALNI MAGACIN — ISTORIJSKA TREBOVANJA

PRAVILO:
POČETNO = 0
TRENUTNO = UKUPNO ULAZA - UKUPNO ZAVRŠENIH/SPAKOVANIH TREBOVANJA

Trebovanje se NE oduzima kada je NOVO ili U PRIPREMI.
Oduzima se tek kada magacioner potvrdi/završi pakovanje i status postane POSLATO/PRIMLJENO/ZAVRSENO.

ISTORIJA:
Aplikacija sada pri učitavanju admin/magacioner podataka prolazi kroz sva stara TREBOVANJA.
Sva stara trebovanja koja su već bila završena automatski ulaze u POTVRĐENO IZAŠLO po artiklima.
Zatim se cm_stock centralnog magacina poravna sa tom računicom.

NEMA DUPLOG ODUZIMANJA:
Računica koristi sam završeni TREBOVANJE dokument kao knjigu izlaza, a ne PRENOS dokumente za prikaz ukupnog izlaza.
Zato novo trebovanje koje napravi PRENOS dokument neće biti duplo oduzeto.

Nije potreban novi SQL za ovu verziju.
