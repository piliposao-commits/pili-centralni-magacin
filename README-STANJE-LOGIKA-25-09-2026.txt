PILI CENTRALNI MAGACIN — ISPRAVNA LOGIKA STANJA

1) POČETNA KOLIČINA je polazna vrednost i ne menja se posle izlaza robe.
2) TRENUTNO STANJE je stvarna količina u centralnom magacinu.
3) Slanje trebovanja iz prodavnice NE skida robu.
4) Tek kada magacioner klikne "POTVRDI I ZAVRŠI TREBOVANJE", poslata količina se oduzima sa TRENUTNOG STANJA.
5) Početna količina tada ostaje ista.
6) Ulaz robe povećava samo trenutno stanje.
7) Popis menja samo trenutno stanje na fizički utvrđenu količinu.
8) Pre prvog kretanja artikla aplikacija automatski zaključava njegovu početnu količinu, pa nije potreban ručni SQL niti nova Supabase tabela.
9) Za artikal kome admin ručno menja početno stanje, dugme SAČUVAJ čuva i početnu vrednost i postavlja trenutno stanje na tu vrednost u tom trenutku.
