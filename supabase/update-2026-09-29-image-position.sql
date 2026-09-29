alter table public.cm_articles
  add column if not exists image_zoom numeric(6,3) not null default 1.00,
  add column if not exists image_x integer not null default 0,
  add column if not exists image_y integer not null default 0;

update public.cm_articles
set
  image_zoom = coalesce(image_zoom, 1.00),
  image_x = coalesce(image_x, 0),
  image_y = coalesce(image_y, 0);
