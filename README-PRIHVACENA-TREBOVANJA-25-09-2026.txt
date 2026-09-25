PILI CENTRALNI MAGACIN — PRIHVAĆENA / SPAKOVANA TREBOVANJA

NOVO PRAVILO:
- Početno stanje = 0.
- Ulaz robe povećava stanje tek kada je knjižen kao završeni ULAZ.
- Trebovanje NE skida stanje dok je NOVO ili U PRIPREMI.
- Tek klik magacionera "POTVRDI I ZAVRŠI TREBOVANJE" pravi PRENOS.
- Potvrđeno izašlo se računa iz stvarnih PRENOS dokumenata iz CENTRALNOG MAGACINA.
- Zbog toga se i ranije već proknjižena/spakovana trebovanja automatski uračunavaju,
  čak i ako je njihov stari status ostao U PRIPREMI.
- Za sva buduća trebovanja API posle uspešnog knjiženja eksplicitno postavlja status POSLATO.
- Isto trebovanje ne može ponovo da se knjiži kada već ima završni status.

FORMULA:
TRENUTNO STANJE = UKUPNO ULAZA - UKUPNO STVARNO PROKNJIŽENIH PRENOSA
