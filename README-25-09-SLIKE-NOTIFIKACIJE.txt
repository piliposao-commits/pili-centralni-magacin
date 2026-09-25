IZMENA 25.09.2026 — SLIKE U TREBOVANJU + NOTIFIKACIJE MAGACIONERU

1) TREBOVANJE SADA UCITAVA SLIKE ARTIKALA IZ SUPABASE STORAGE-a.
   - app/api/trebovanje-data/route.ts vraca image_url uz svaki artikal.
   - app/trebovanje/page.tsx prikazuje sliku umesto ikonice kutije kada slika postoji.

2) STARE SLIKE IZ BROWSERA SE AUTOMATSKI PREBACUJU NA SERVER.
   - Kada se ADMIN prijavi na racunaru na kom su stare slike sacuvane lokalno,
     aplikacija pokusava da ih prebaci u Supabase Storage.
   - Posle toga iste slike vide i trebovanja na drugim uredjajima.

3) NOTIFIKACIJE ZA MAGACIONERA.
   - Magacioner dobija dugme UKLJUCI NOTIFIKACIJE.
   - Kada stigne novo trebovanje, aplikacija proverava nova trebovanja na 8 sekundi.
   - Pusta zvuk i prikazuje sistemsku browser/PWA notifikaciju ako je dozvola ukljucena.
   - Klik na notifikaciju vraca korisnika u Centralni magacin.

VAZNO:
Na svakom telefonu/racunaru magacionera jednom kliknuti UKLJUCI NOTIFIKACIJE i dozvoliti obavestenja u browseru.
Za potpuno pouzdanu isporuku kada je aplikacija potpuno ugasena potreban je poseban Web Push server/VAPID servis. Ova verzija radi dok je PWA/browser aktivan ili u pozadini, u granicama koje telefon dozvoljava.
