-- POKRENI SAMO JEDNOM u Supabase SQL Editor-u.
-- Ovim se samo POSLEDNJE staro PILI PLUS trebovanje koje je ostalo "U PRIPREMI"
-- označava kao prihvaćeno/završeno. Ne menja ulaze robe.
-- Nova aplikacija će zatim njegove stavke uračunati u POTVRĐENO IZAŠLO.
WITH target AS (
  SELECT d.id
  FROM public.cm_documents d
  JOIN public.cm_locations l ON l.id = d.destination_location_id
  WHERE d.type = 'TREBOVANJE'
    AND upper(coalesce(d.status,'')) = 'U PRIPREMI'
    AND upper(trim(l.name)) = 'PILI PLUS'
  ORDER BY d.created_at DESC
  LIMIT 1
)
UPDATE public.cm_documents d
SET status = 'POSLATO',
    updated_at = now()
FROM target t
WHERE d.id = t.id
RETURNING d.id, d.status, d.created_at, d.destination_location_id;
