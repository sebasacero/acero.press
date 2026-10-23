-- Encuesta del tintero: ¿qué preferiría, una nueva preparación (kit AeroPress)
-- o un termo con café de especialidad listo para vender? Y, si elige el termo,
-- cuántas tazas de él vendería al día.

set lock_timeout = '5s';

alter table public.tintero_surveys
  add column if not exists offer_choice text,
  add column if not exists thermo_cups_day integer;

alter table public.tintero_surveys drop constraint if exists tintero_surveys_offer_choice_check;
alter table public.tintero_surveys add constraint tintero_surveys_offer_choice_check
  check (offer_choice in ('preparacion', 'termo', 'ninguna'));
alter table public.tintero_surveys drop constraint if exists tintero_surveys_thermo_cups_day_check;
alter table public.tintero_surveys add constraint tintero_surveys_thermo_cups_day_check
  check (thermo_cups_day between 0 and 500);
