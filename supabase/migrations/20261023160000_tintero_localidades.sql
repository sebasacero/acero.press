-- Las 20 localidades de Bogotá en la ficha del tintero. El estudio arrancó
-- con nueve (las objetivo y las de más vendedores); en la calle aparecen
-- tinteros en todas, y «Otra» queda para lo que no es Bogotá (Soacha, Chía).
--
-- La localidad sale del check grande a uno propio, para que agregar una no
-- obligue a reescribir el resto de la ficha. Mismos valores que
-- LOCALIDADES (src/features/admin/micra/place.js) y Localidad en
-- api/_acero/bi/routes.py.
set lock_timeout = '5s';

alter table public.tinteros drop constraint if exists tinteros_ficha_estudio_check;
alter table public.tinteros add constraint tinteros_ficha_estudio_check check (
  (formato is null or formato in ('termos_a_pie', 'carrito', 'bicicleta', 'puesto_fijo', 'otro'))
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

alter table public.tinteros drop constraint if exists tinteros_localidad_check;
alter table public.tinteros add constraint tinteros_localidad_check check (
  localidad is null or localidad in (
    'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón',
    'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda',
    'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz', 'Otra')
);
