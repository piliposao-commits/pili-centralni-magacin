PROBLEM:
Ulaz šećera 200.
Prvo trebovanje 100 -> trenutno stanje 100.
Drugo trebovanje 100 -> trenutno stanje 0.
Magacioner nije mogao da čekira drugo trebovanje zato što je aplikacija proveravala
već umanjeno stanje 0, iako je tih 100 već rezervisano baš za to trebovanje.

ISPRAVKA:
Magacioner za konkretno trebovanje vidi i koristi:
trenutno stanje POSLE rezervacije + količina tog trebovanja.

Primer:
trenutno posle drugog trebovanja = 0
drugo trebovanje = 100
raspoloživo za to trebovanje = 100
=> magacioner može normalno da čekira i potvrdi 100.

Ako magacioner spakuje manje, npr. 80, sistem menja trebovanje na 80
i vraća razliku 20 u centralno stanje pri preračunu.

Ne treba novi SQL.
