-- Encuesta del tintero: además de hace cuánto vende café, hace cuánto vende
-- en ese mismo lugar (el que ya tiene su esquina frente al que está probando sitio).

set lock_timeout = '5s';

alter table public.tintero_surveys add column if not exists years_here text;
alter table public.tintero_surveys drop constraint if exists tintero_surveys_years_here_check;
alter table public.tintero_surveys add constraint tintero_surveys_years_here_check
  check (years_here in ('menos_1m', '1_6m', '6_12m', '1_3', 'mas_3'));
