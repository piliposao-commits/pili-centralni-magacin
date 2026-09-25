-- Prikazuje trenutno stanje centralnog magacina.
select a.sifra, a.naziv, s.qty as trenutno_stanje, a.jm
from public.cm_stock s
join public.cm_articles a on a.id=s.article_id
join public.cm_locations l on l.id=s.location_id
where l.type='CENTRAL'
order by a.naziv;
