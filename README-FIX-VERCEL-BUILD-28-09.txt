FIX VERCEL BUILD 28.09.2026

Ispravljena je TypeScript greška koju Vercel prikazuje u app/page.tsx oko linije 1213.

Problem:
Unutar ADMIN-only bloka kod je proveravao user.role === "MAGACIONER".
TypeScript to odbija jer je u tom bloku user.role već ADMIN.

Ispravka:
Admin dugme Trebovanja sada prikazuje samo broj zahteva za knjiženje.
Magacionerski brojač ostaje u magacionerskom delu.

Ne treba novi SQL.
