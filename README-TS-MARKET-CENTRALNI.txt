PILI CENTRALNI MAGACIN -> TS MARKET
30.10.2026

OVO JE IMPLEMENTACIJA ISTOG PULL/ACK UGOVORA KOJI JE POSLAT PROGRAMERU TS MARKETA.

TOK:
1. Magacioner čekira i potvrdi trebovanje -> status POSLATO.
2. Admin klikne PROKNJIŽI.
3. Aplikacija generiše po jednu TS Market movement stavku sa kind=WAREHOUSE_TRANSFER.
4. Trebovanje dobija status POSLATO_TS i u adminu se vidi "TS MARKET — ČEKA POTVRDU".
5. TS Market čita GET /api/integrations/ts-market/v1/movements
6. TS Market knjiži: iz magacina 20 -> u odredišnu prodavnicu.
7. TS Market šalje POST /api/integrations/ts-market/v1/acknowledgements.
8. Kada SVE stavke trebovanja dobiju POSTED, PILI automatski postavlja PRIMLJENO.
9. Ako TS Market pošalje REJECTED, trebovanje se vraća adminu na ponovno PROKNJIŽI.

VAŽNO:
- Movement ID + revision su idempotency ključ. Ista stavka se ne sme dva puta knjižiti.
- Centralni TS Market magacin je fiksno 20.
- Za prodavnice koristimo cm_locations.ts_market_warehouse_code.
- Ako šifra TS Market prodavnice nije upisana, API vraća TO_MAP, kao u prvobitnom JSON-u.

SUPABASE:
Pokreni jednom:
RUN-JEDNOM-TS-MARKET-INTEGRACIJA.sql

VERCEL:
Dodaj Environment Variable:
TS_MARKET_INTEGRATION_TOKEN = isti Bearer token koji koristi programer TS Marketa.

API BASE URL OVOG PROJEKTA:
https://pili-centralni-magacin.vercel.app/api/integrations/ts-market/v1

ENDPOINTI:
GET  /movements
POST /acknowledgements

Programeru pošalji fajl:
PILI_TS_MARKET_API_SPEC_CENTRALNI.json
