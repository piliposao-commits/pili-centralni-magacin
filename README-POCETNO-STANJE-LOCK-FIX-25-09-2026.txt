PILI CENTRALNI MAGACIN — FIX POČETNOG STANJA

PRAVILO POSLE OVE VERZIJE:
1. POČETNO STANJE je istorijska, odvojena vrednost i NE MENJA SE kada roba ulazi ili izlazi.
2. TRENUTNO STANJE se menja: ULAZ +, potvrđeno TREBOVANJE/PRENOS -, POPIS postavlja fizičko stanje.
3. Prvi ADMIN load posle deploy-a JEDNOM rekonstruiše stara početna stanja iz istorije:
   početno = trenutno - ulazi + prenosi iz centralnog magacina.
4. Primer: ako je SVEPS BITER LEMON početno 234, a 27 je izašlo, početno ostaje 234 a trenutno je 207.
5. Dugme SAČUVAJ u Početnom stanju od sada menja SAMO početno stanje, nikad trenutno.
6. Novi artikli koji nastanu kasnijim ulazom imaju početno 0 dok admin ručno ne postavi drugačije.

Nije potreban novi SQL za ovaj fix.
