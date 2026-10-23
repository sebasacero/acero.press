-- Filtro «Tintero aliado» de Micra: publicidad de un tintero en redes con su
-- nombre, su lugar y lo que vende. Es un permiso aparte del de la foto del
-- estudio (privada): sin él, Micra no deja armar su tarjeta. Se guarda
-- cuándo lo dio (ley 1581 de 2012: autorización previa y demostrable).

set lock_timeout = '5s';

alter table public.tinteros
  add column if not exists ad_consent boolean not null default false,
  add column if not exists ad_consent_at timestamptz;
