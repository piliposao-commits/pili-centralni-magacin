PILI CENTRALNI MAGACIN - AUTO KORISNICI TREBOVANJA

Ova verzija ne zahteva ručni SQL unos za sledeće korisnike.
Pri prvom logovanju sa lozinkom 1234 aplikacija će ih sama kreirati u cm_users:

mijatovic.olivera / 1234 - unapred vezana za BOLJEVCI
popovic.milena / 1234
cumic.jelena / 1234
bjelic.biljana / 1234
ivkovic.sonja / 1234

Za korisnike bez lokacije, prvi put se bira prodavnica, a izbor se čuva u bazi.

Posle raspakivanja preko postojećeg projekta:
1. npm install
2. npm run build
3. vercel --prod

Postojeći .env.local ne menjati niti prepisivati.
