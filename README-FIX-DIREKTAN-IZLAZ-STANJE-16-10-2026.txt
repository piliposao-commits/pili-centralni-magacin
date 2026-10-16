PILI CENTRALNI MAGACIN — FIX 16.10.2026

PROBLEM:
- direktan izlaz robe je bio vidljiv u istoriji kao PRENOS,
- ali reconcileCentralStock je kao izlaz računao samo TREBOVANJE,
- zato se posle osvežavanja stanje vraćalo kao da direktnog izlaza nije bilo.

ISPRAVKA:
- stvarni izlaz centralnog magacina sada se računa iz PRENOS dokumenata sa statusom POSLATO/PRIMLJENO/ZAVRSENO,
- računa se samo PRENOS čiji je source_location_id centralni magacin,
- TREBOVANJE se više ne sabira kao poseban izlaz jer je zahtev; stvarno fizičko kretanje je PRENOS,
- time se sprečava i duplo skidanje robe.

Formula:
TRENUTNO STANJE = ZAVRSENI ULAZI - STVARNI PRENOSI IZ CENTRALNOG MAGACINA

TypeScript provera: PROSLA.
Next production build nije mogao da zavrsi u izolovanom okruzenju jer Next pokusava da preuzme Linux SWC paket sa registry.npmjs.org, a mreza u ovom okruzenju nije dostupna. Kod prolazi tsc --noEmit.
