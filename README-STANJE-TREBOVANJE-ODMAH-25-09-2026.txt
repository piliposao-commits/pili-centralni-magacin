PILI CENTRALNI MAGACIN — NOVA ZAKLJUČANA LOGIKA STANJA

POČETNO STANJE = 0

TRENUTNO STANJE =
UKUPNO UŠLO ROBE
MINUS
SVA UNEŠENA TREBOVANJA

PRAVILO:
- Čim prodavnica pošalje trebovanje, količine iz njega se odmah skidaju sa centralnog stanja.
- Ne čeka se da magacioner otvori, prihvati ili spakuje robu.
- I stara trebovanja se automatski računaju, bez obzira da li su NOVO, U PRIPREMI, POSLATO, PRIMLJENO ili ZAVRŠENO.
- Samo OTKAZANO / STORNIRANO / ODBIJENO trebovanje se ne skida.
- PRENOS se više ne računa dodatno, tako da nema duplog skidanja.
- Posle novog trebovanja cm_stock se odmah preračunava.

Primer:
Ulaz 144 kom
Trebovanje 15 kom
Trenutno = 129 kom odmah nakon slanja trebovanja.
