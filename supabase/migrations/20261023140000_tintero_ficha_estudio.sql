-- Ficha del tintero con los datos que pide el estudio de mercado (Plan Micra).
--
-- El foco es el tintero que ya recorre una ruta con sus clientes: en qué
-- localidad está (las del estudio: objetivo y de más vendedores), cómo vende
-- (termos a pie, carrito, puesto fijo), si hace ruta, a qué horas, qué vende
-- y a cuánto, qué clientes tiene, cómo le pagan (fiado incluido) y si está en
-- el registro del IPES (Decreto 117 de 2026). Todo es opcional menos lo que
-- ya pedía la ficha: una ficha vieja sigue valiendo.
--
-- La localidad va aparte de `zone` (el sector que ya usaban las ventas) y de
-- la cuadra, que en el sur no aplica: la cuadrícula de carrera y calle del
-- mapa es la del norte.
set lock_timeout = '5s';

alter table public.tinteros add column if not exists localidad text;
alter table public.tinteros add column if not exists formato text;
alter table public.tinteros add column if not exists recorrido text;
alter table public.tinteros add column if not exists hora_inicio smallint;
alter table public.tinteros add column if not exists hora_fin smallint;
alter table public.tinteros add column if not exists termos smallint;
alter table public.tinteros add column if not exists products text[];
alter table public.tinteros add column if not exists perico_price numeric;
alter table public.tinteros add column if not exists aromatica_price numeric;
alter table public.tinteros add column if not exists client_mix text;
alter table public.tinteros add column if not exists client_types text[];
alter table public.tinteros add column if not exists payments_seen text[];
alter table public.tinteros add column if not exists ipes text;

alter table public.tinteros drop constraint if exists tinteros_ficha_estudio_check;
alter table public.tinteros add constraint tinteros_ficha_estudio_check check (
  (localidad is null or localidad in ('Chapinero', 'Usaquén', 'Teusaquillo', 'Barrios Unidos', 'Fontibón',
                                      'Santa Fe', 'La Candelaria', 'Kennedy', 'Bosa', 'Otra'))
  and (formato is null or formato in ('termos_a_pie', 'carrito', 'bicicleta', 'puesto_fijo', 'otro'))
  and (recorrido is null or recorrido in ('ruta', 'mixto', 'fijo'))
  and (hora_inicio is null or hora_inicio between 0 and 23)
  and (hora_fin is null or hora_fin between 1 and 24)
  and (hora_inicio is null or hora_fin is null or hora_fin > hora_inicio)
  and (termos is null or termos between 0 and 20)
  and (products is null or products <@ array['tinto', 'perico', 'aromatica', 'chocolate', 'agua_panela', 'ponque',
                                             'galletas', 'empanadas', 'cigarrillos', 'dulces']::text[])
  and (perico_price is null or perico_price between 0 and 50000)
  and (aromatica_price is null or aromatica_price between 0 and 50000)
  and (client_mix is null or client_mix in ('fijos', 'mitad', 'de_paso'))
  and (client_types is null or client_types <@ array['oficinistas', 'porteros', 'obreros', 'taxistas', 'conductores',
                                                     'estudiantes', 'vendedores', 'vecinos', 'transeuntes']::text[])
  and (payments_seen is null or payments_seen <@ array['efectivo', 'nequi', 'daviplata', 'bre_b', 'fiado']::text[])
  and (ipes is null or ipes in ('si', 'no', 'no_sabe'))
);
create index if not exists tinteros_localidad_idx on public.tinteros (localidad) where localidad is not null;
