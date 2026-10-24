-- Ficha del tintero con GPS: en la calle nadie sabe la cuadra (y en el sur la
-- numeración no sigue la cuadrícula del norte). Se guarda el punto del GPS del
-- celular, su precisión y una referencia que se entienda («puerta principal de
-- Plaza de las Américas»). La cuadra queda opcional para quien la sepa.

set lock_timeout = '5s';

alter table public.tinteros
  add column if not exists lat numeric(9,6),
  add column if not exists lng numeric(9,6),
  add column if not exists gps_accuracy_m integer,
  add column if not exists located_at timestamptz,
  add column if not exists referencia text;

alter table public.tinteros drop constraint if exists tinteros_gps_check;
alter table public.tinteros add constraint tinteros_gps_check check (
  num_nonnulls(lat, lng) in (0, 2)
  and (lat is null or (lat between 3.7 and 4.85 and lng between -74.5 and -73.95))
  and (gps_accuracy_m is null or gps_accuracy_m between 0 and 5000)
);
alter table public.tinteros drop constraint if exists tinteros_referencia_check;
alter table public.tinteros add constraint tinteros_referencia_check check (referencia is null or char_length(referencia) between 1 and 80);
