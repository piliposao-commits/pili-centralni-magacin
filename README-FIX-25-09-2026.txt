PILI CENTRALNI MAGACIN — FIX 25.09.2026

ISPRAVLJENO:
1. Novi artikli iz ulaza robe se sada direktno upisuju u cm_articles i cm_stock i odmah ulaze u Stanje / vrednost.
2. Postojeci artikal po istoj sifri dobija samo dodatnu kolicinu; ne pravi se duplikat.
3. /trebovanje stranica je ukljucena u projekat.
4. Slika artikla nije obavezna pri ulazu.
5. U Stanje / vrednost: izaberi sliku -> SAČUVAJ SLIKU. Slika se cuva u Supabase Storage bucket cm-article-images.
6. Jednom sacuvana slika je zakljucana i nema PROMENI SLIKU.
7. Barkod se moze dodati naknadno samo ako artikal nema barkod.
8. Jednom sacuvan barkod je zakljucan i vise nema polje za izmenu.
9. Duplikat barkoda se odbija.

Za deploy zameni ceo folder ovim projektom i pokreni npm install / npm run build / Vercel deploy kao i do sada.
