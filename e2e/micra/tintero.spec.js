// Estudio de calle: registrar un tintero desde la cámara de Micra en dos minutos.
import { test, expect } from '@playwright/test';
import { openPage, openMicraFromHome, PHONE } from './fixtures.js';

// Frente a la estación de la 72 (Chapinero), con 9 m de precisión
const GPS = { ...PHONE, permissions: [...PHONE.permissions, 'geolocation'], geolocation: { latitude: 4.6577, longitude: -74.0634, accuracy: 9 } };

test('tintero con foto y permiso: la foto va al bucket privado y la ficha a la API de BI', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser, { context: GPS });
  await openMicraFromHome(page);
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await page.getByRole('button', { name: 'Registrar un tintero' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ficha de un tintero' });
  await expect(sheet).toBeVisible();
  await expect(page.locator('.mstudio.is-camera')).toHaveCount(1); // la cámara sigue detrás

  await sheet.getByRole('button', { name: 'Tomar foto' }).click();
  await expect(sheet.getByRole('img', { name: 'Foto del puesto' })).toBeVisible();
  await expect(page.locator('.mstudio.is-edit')).toHaveCount(0); // la foto de ficha no abre el editor
  await sheet.getByLabel('Dio permiso para la foto').check();

  await sheet.getByPlaceholder(/Don Jairo/).fill('Don Jairo');
  await expect(sheet.getByLabel('Datos del estudio anotados')).toHaveText('0 de 14');
  await sheet.getByRole('option', { name: 'Chapinero' }).click();
  // Dónde está: el GPS del celular y una referencia; la cuadra no hace falta
  await expect(sheet.getByLabel('Calle')).toBeHidden();
  await sheet.getByRole('button', { name: '📍 Usar mi ubicación' }).click();
  await expect(sheet.getByTestId('tintero-gps')).toContainText('Marcado · ±9 m');
  await sheet.getByLabel('Referencia').fill('Salida de la estación de la 72');
  // Lo que el estudio necesita: cómo vende, su ruta, horario, productos, clientes y pagos
  await sheet.getByRole('group', { name: 'Cómo vende' }).getByRole('button', { name: 'Termos a pie' }).click();
  await sheet.getByRole('group', { name: '¿Se mueve?' }).getByRole('button', { name: 'Hace una ruta' }).click();
  await sheet.getByRole('group', { name: 'Empieza a vender' }).getByRole('button', { name: '6 a. m.' }).click();
  await sheet.getByRole('group', { name: 'Termina' }).getByRole('button', { name: '11 a. m.' }).click();
  await sheet.getByRole('group', { name: 'Qué vende' }).getByRole('button', { name: 'Tinto' }).click();
  await sheet.getByRole('group', { name: 'Qué vende' }).getByRole('button', { name: 'Perico' }).click();
  await sheet.getByLabel('Precio del tinto').fill('1.500');
  await sheet.getByLabel('Precio del perico').fill('1.700');
  await sheet.getByLabel('Termos').fill('3');
  await sheet.getByLabel('Tazas por hora').fill('25');
  await sheet.getByRole('group', { name: 'Sus clientes' }).getByRole('button', { name: 'Casi todos fijos' }).click();
  await sheet.getByRole('group', { name: 'Quiénes le compran' }).getByRole('button', { name: 'Porteros' }).click();
  await sheet.getByRole('group', { name: 'Cómo le pagan' }).getByRole('button', { name: 'Fiado' }).click();
  await sheet.getByRole('group', { name: '¿Registrado en el IPES?' }).getByRole('button', { name: 'No sabe' }).click();
  await expect(sheet.getByLabel('Datos del estudio anotados')).toHaveText('14 de 14');
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();

  // Guardada la ficha, sigue la encuesta: sin el permiso no se puede marcar ni guardar
  const enc = page.getByRole('dialog', { name: 'Encuesta de Don Jairo' });
  await expect(enc.getByRole('status')).toContainText('La ficha de Don Jairo quedó guardada con su foto');
  await expect(enc.getByRole('button', { name: 'Guardar encuesta' })).toBeDisabled();
  await expect(enc.getByRole('group', { name: 'Días a la semana' }).getByRole('button', { name: '6' })).toBeDisabled();
  await enc.getByLabel('Aceptó responder').check();
  await enc.getByRole('group', { name: 'Tazas al día: valores rápidos' }).getByRole('button', { name: '80' }).click();
  await enc.getByRole('group', { name: 'Días a la semana' }).getByRole('button', { name: '6' }).click();
  await enc.getByRole('group', { name: 'Qué café usa' }).getByRole('button', { name: 'Águila Roja' }).click();
  await enc.getByRole('group', { name: 'Libras a la semana (de 500 g): valores rápidos' }).getByRole('button', { name: '3' }).click();
  await enc.getByLabel('A cuánto compra la libra').fill('20.000');
  await enc.getByRole('group', { name: '¿Vendería una taza de especialidad?' }).getByRole('button', { name: 'Tal vez' }).click();
  await enc.getByLabel('¿A cuánto la vendería?').fill('4.000');
  // Preparación o termo: las tazas del termo solo aparecen si elige el termo
  const offer = enc.getByRole('group', { name: /nueva preparación o un termo/ });
  await expect(enc.getByLabel('¿Cuántas tazas del termo vendería al día?')).toHaveCount(0);
  await offer.getByRole('button', { name: 'Termo con café listo' }).click();
  await enc.getByRole('group', { name: '¿Cuántas tazas del termo vendería al día?: valores rápidos' }).getByRole('button', { name: '30' }).click();
  await enc.getByRole('group', { name: '¿Hace cuánto vende café?' }).getByRole('button', { name: 'Más de 10' }).click();
  await enc.getByRole('group', { name: '¿Y en este lugar?' }).getByRole('button', { name: 'Más de 3 años' }).click();
  await enc.getByRole('group', { name: '¿Cómo le pagan?' }).getByRole('button', { name: 'Nequi' }).click();
  await enc.getByRole('group', { name: 'Género' }).getByRole('button', { name: 'Prefiere no decir' }).click();
  await expect(enc.locator('.srv-progress')).toContainText('12 de 19');
  await enc.getByRole('button', { name: 'Guardar encuesta' }).click();

  // Después de la encuesta, su tarjeta: llena con la ficha y la encuesta, y solo con su permiso de publicidad
  const card = page.getByRole('dialog', { name: 'Tarjeta de Don Jairo' });
  const preview = card.getByTestId('tintero-card-preview');
  await expect(preview).toContainText('Don Jairo');
  await expect(preview).toContainText('Salida de la estación de la 72');
  await expect(preview).toContainText('Vende: Tinto $1.500 · Perico $1.700');
  await expect(preview).toContainText('6 días a la semana');
  await expect(preview).toContainText('+10 años vendiendo · +3 años aquí · 6 días a la semana');
  await expect(preview).not.toContainText('Prefiere no decir');
  const shoot = card.getByRole('button', { name: 'Tomar la foto de su tarjeta' });
  await expect(shoot).toBeDisabled();
  await card.getByLabel('Aceptó salir en la publicidad').check();
  await shoot.click();
  await expect(card).toHaveCount(0);
  expect(api.find(`/api/v1/bi/tinteros/${api.tinteros[0].id}`, 'PATCH').data).toEqual({ ad_consent: true });
  await expect(page.locator('.mst-toast')).toContainText('Tarjeta de Don Jairo lista');
  await expect(page.locator('.mc-text', { hasText: 'Tintero: Don Jairo' })).toBeVisible();
  await expect(page.locator('.mc-text', { hasText: 'Anuncio:' })).toContainText('Vende: Tinto $1.500 · Perico $1.700');
  await expect(page.locator('.mc-filter-name')).toContainText('Tintero aliado');
  const sv = api.all('/surveys', 'POST')[0];
  expect(sv.p).toBe(`/api/v1/bi/tinteros/${api.tinteros[0].id}/surveys`);
  expect(sv.data).toMatchObject({ consent: true, cups_per_day: 80, days_per_week: 6, coffee_brand: 'Águila Roja', coffee_g_week: 1500, coffee_price_kg: 40000, would_sell_specialty: 'tal_vez', specialty_price: 4000, payments: ['nequi'], gender: 'prefiere_no', years_selling: 'mas_10', years_here: 'mas_3', offer_choice: 'termo', thermo_cups_day: 30 });

  const upload = api.calls.find((c) => c.p.includes('/storage/v1/object/'));
  expect(upload.p).toContain('/object/estudio/tinteros/');
  expect(upload.p).not.toContain('marketing');
  const post = api.find('/api/v1/bi/tinteros', 'POST');
  expect(post.data).toMatchObject({
    name: 'Don Jairo', localidad: 'Chapinero', zone: 'Salida de la estación de la 72', referencia: 'Salida de la estación de la 72', lat: 4.6577, lng: -74.0634, gps_accuracy_m: 9, tinto_price: 1500, perico_price: 1700, cups_per_hour: 25,
    photo_consent: true, stage: 'prospecto', formato: 'termos_a_pie', recorrido: 'ruta', hora_inicio: 6, hora_fin: 11, termos: 3,
    products: ['tinto', 'perico'], client_mix: 'fijos', client_types: ['porteros'], payments_seen: ['fiado'], ipes: 'no_sabe',
  });
  expect(post.data.photo_url).toMatch(/^https:\/\/.+\/estudio\/tinteros\//);
  expect(post.data.surveyed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(api.tinteros).toHaveLength(1);
  await expect(sheet).toHaveCount(0);
  await expect(enc).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.context().close();
});

test('sin permiso la foto no sube; sin nombre no se guarda nada', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  await openMicraFromHome(page);
  await page.waitForFunction(() => document.querySelector('.mc-video')?.readyState >= 2);
  await page.getByRole('button', { name: 'Registrar un tintero' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ficha de un tintero' });
  await sheet.getByRole('button', { name: 'Tomar foto' }).click();
  await expect(sheet.getByRole('img', { name: 'Foto del puesto' })).toBeVisible();

  // Sin nombre: se explica y no sale ninguna petición
  await sheet.getByRole('option', { name: 'Chapinero' }).click();
  await sheet.getByText('Sé la cuadra (opcional)').click();
  await sheet.getByLabel('Calle').fill('83');
  await sheet.getByLabel('Carrera').fill('13');
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  await expect(sheet.getByRole('alert')).toContainText('nombre');
  expect(api.find('/api/v1/bi/tinteros', 'POST')).toBeUndefined();
  expect(api.calls.some((c) => c.p.includes('/storage/v1/object/'))).toBe(false);

  // Con nombre pero sin permiso: la ficha sí, la foto no
  await sheet.getByPlaceholder(/Don Jairo/).fill('Carrito de la 83');
  // Sin localidad tampoco: es lo mínimo que pide el estudio
  await sheet.getByRole('option', { name: 'Chapinero' }).click();
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  await expect(sheet.getByRole('alert')).toContainText('localidad');
  // Están las 20 localidades: las que no eran del estudio van en su grupo
  const resto = sheet.getByRole('listbox', { name: 'Localidad: las demás localidades' });
  await expect(resto.getByRole('option')).toHaveCount(11);
  await resto.getByRole('option', { name: 'Ciudad Bolívar' }).click();
  await expect(resto.getByRole('option', { name: 'Ciudad Bolívar' })).toHaveAttribute('aria-selected', 'true');
  await sheet.getByRole('option', { name: 'Usaquén' }).click();
  await expect(resto.getByRole('option', { name: 'Ciudad Bolívar' })).toHaveAttribute('aria-selected', 'false');
  await sheet.getByRole('button', { name: 'Guardar tintero' }).click();
  // La encuesta se puede dejar para después: la ficha ya quedó
  await page.getByRole('dialog', { name: 'Encuesta de Carrito de la 83' }).getByRole('button', { name: /Ahora no/ }).click();
  await page.getByRole('dialog', { name: 'Tarjeta de Carrito de la 83' }).getByRole('button', { name: 'Listo, sin tarjeta' }).click();
  await expect(page.locator('.mst-toast')).toContainText('Carrito de la 83 quedó en el estudio');
  await expect(page.locator('.mst-toast')).not.toContainText('con su foto');
  await expect(page.locator('.mst-toast')).not.toContainText('encuesta');
  expect(api.all('/surveys', 'POST')).toHaveLength(0);
  expect(api.calls.some((c) => c.p.includes('/storage/v1/object/'))).toBe(false);
  const post = api.find('/api/v1/bi/tinteros', 'POST');
  expect(post.data.photo_consent).toBe(false);
  expect(post.data.photo_url).toBeUndefined();
  expect(post.data).toMatchObject({ localidad: 'Usaquén', zone: 'Usaquén', carrera: 13, calle: 83 });
  expect(errors).toEqual([]);
  await page.context().close();
});

test('filtro «Tintero aliado»: la tarjeta sale de su ficha y solo con su permiso de publicidad', async ({ browser }) => {
  const { page, api, errors } = await openPage(browser);
  api.tinteros.push(
    { id: 'tintero-1', name: 'Don Jairo', localidad: 'Chapinero', zone: 'Chapinero', carrera: 13, calle: 72, products: ['tinto', 'perico'], tinto_price: 1500, perico_price: 2000, hora_inicio: 6, hora_fin: 12, ad_consent: true },
    { id: 'tintero-2', name: 'Doña Rosa', localidad: 'Bosa', products: ['tinto', 'aromatica'], tinto_price: 1200, ad_consent: false },
  );
  await openMicraFromHome(page);
  await page.click('.mc-kinds button:has-text("Anuncio")');
  await page.getByRole('option', { name: 'Tintero aliado' }).click();
  const pick = page.locator('.mc-text', { hasText: 'Elegir tintero' });
  await expect(pick).toBeVisible();
  await pick.click();

  const sheet = page.getByRole('dialog', { name: 'Tintero aliado' });
  await expect(sheet.getByRole('listitem')).toHaveCount(2);
  await sheet.getByRole('button', { name: /Don Jairo/ }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.mc-text', { hasText: 'Tintero: Don Jairo' })).toBeVisible();
  await expect(page.locator('.mc-text', { hasText: 'Anuncio:' })).toContainText('Vende: Tinto $1.500 · Perico $2.000');

  // Sin permiso no se usa: se le pregunta y queda anotado en su ficha
  await page.locator('.mc-text', { hasText: 'Tintero: Don Jairo' }).click();
  await sheet.getByRole('button', { name: /Doña Rosa/ }).click();
  await expect(sheet.getByRole('button', { name: /Doña Rosa/ })).toContainText('Falta su permiso');
  await expect(page.locator('.mc-text', { hasText: 'Tintero: Don Jairo' })).toBeVisible(); // sigue el anterior
  await sheet.getByRole('button', { name: 'Aceptó: usar en la tarjeta' }).click();
  await expect(sheet).toHaveCount(0);
  expect(api.find('/api/v1/bi/tinteros/tintero-2', 'PATCH').data).toEqual({ ad_consent: true });
  await expect(page.locator('.mc-text', { hasText: 'Tintero: Doña Rosa' })).toBeVisible();
  await expect(page.locator('.mc-text', { hasText: 'Anuncio:' })).toContainText('Vende: Tinto $1.200 · Aromática');
  expect(errors).toEqual([]);
  await page.context().close();
});
