# Guía de configuración — AceroPress

Este documento resume **todo** lo que hay que configurar para que el sitio, el
panel de admin, los pagos y el login con Google funcionen de verdad. Está
organizado en el orden recomendado para hacerlo.

---

## 0. Regla de oro: dos tipos de llaves

Antes de tocar nada, la distinción más importante de todo este documento:

| Tipo | Dónde vive | Ejemplos | Riesgo si se filtra |
|---|---|---|---|
| **Pública** | Frontend (prefijo `VITE_`, va en el bundle del navegador) | `VITE_SUPABASE_ANON_KEY`, `VITE_WOMPI_PUBLIC_KEY` | Ninguno — están diseñadas para ser públicas, la seguridad real la da RLS |
| **Secreta** | Solo en variables de entorno del servidor (Vercel/Netlify) | `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `WOMPI_PRIVATE_KEY` | Control total sobre tu base de datos o dinero — nunca en el código, nunca en `VITE_*` |

Todas las variables secretas se configuran en: **Vercel → tu proyecto → Settings → Environment Variables**.

---

## 1. Supabase — la base de todo

### 1.1 Llaves que ya tienes configuradas
```
VITE_SUPABASE_URL=https://tylylfrabjkaiukuilem.supabase.co
VITE_SUPABASE_ANON_KEY=<tu anon key>
```
Van en tu `.env` local y en Vercel. Son públicas — protegidas por RLS, no por secreto.

### 1.2 Llave que falta para las funciones serverless
Tus funciones en `/api` (crear pagos, webhooks) necesitan permisos elevados para
escribir en la base de datos saltándose RLS (por ejemplo, para confirmar un
pedido cuando llega el webhook de Stripe). Para eso:

1. Dashboard de Supabase → **Project Settings → API**
2. Copia la **`service_role` secret key**
3. Configúrala en Vercel como:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<la llave secreta>
   SUPABASE_URL=https://tylylfrabjkaiukuilem.supabase.co
   ```
   (Sin prefijo `VITE_` — esta nunca debe llegar al navegador.)

**La usan:** `/api/create-checkout-session.js`, `/api/stripe-webhook.js`,
`/api/create-local-payment.js`, `/api/wompi-webhook.js`.

### 1.3 Habilitar Google como proveedor de login
Esto lo hace todo el sistema de cuentas de cliente (drawer de "Mi cuenta",
suscripción a ofertas, envío mensual, historial de pedidos).

1. **Google Cloud Console** (console.cloud.google.com) → crea un proyecto si no
   tienes uno → **APIs & Services → Credentials → Create Credentials → OAuth
   client ID** → tipo "Web application"
2. En **Authorized redirect URIs** agrega exactamente:
   ```
   https://tylylfrabjkaiukuilem.supabase.co/auth/v1/callback
   ```
3. Copia el **Client ID** y **Client Secret** que te da Google
4. **Supabase Dashboard → Authentication → Providers → Google** → actívalo →
   pega esas dos credenciales → guarda

No requiere ninguna variable de entorno en tu código — todo queda configurado
del lado de Supabase.

5. **Mi ruta** (`/ruta`, la app del tintero) vuelve de Google a `/ruta`. En
   **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**
   agrega `https://www.aceropress.com/ruta` (y `http://localhost:5173/ruta` para
   probar en local). Sin eso, Supabase devuelve al tintero a la portada.

### 1.4 Crear tu primer usuario admin (panel `/admin`)
No lo puedo hacer yo por ti (mis herramientas no crean usuarios de auth):

1. Supabase Dashboard → **Authentication → Users → Add user** → tu correo + contraseña
2. Copia el `UUID` del usuario que se crea
3. Pídeme que lo inserte en `admin_users`, o hazlo tú mismo:
   ```sql
   insert into public.admin_users (auth_user_id, role, full_name)
   values ('<uuid-del-usuario>', 'owner', 'Tu nombre');
   ```

---

## 2. Número de WhatsApp — ya no está en el código

Antes vivía escrito en `CartContext.jsx`. Ahora vive en la tabla
`app_config` de Supabase (columna `key='whatsapp_number'`), de lectura pública
(el número igual termina siendo visible en el link `wa.me` que genera el
sitio, así que no hay ningún problema de seguridad en que sea legible).

**Para cambiarlo:** entra al panel `/admin` → pestaña **Configuración** →
edita el número → Guardar. Se actualiza al instante en todo el sitio, sin
tocar código ni volver a desplegar.

---

## 3. Stripe — pagos internacionales (USD)

```
STRIPE_SECRET_KEY=sk_test_xxxxx      (o sk_live_xxxxx para cobrar de verdad)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

1. Cuenta en dashboard.stripe.com → **Developers → API keys** → copia la
   "Secret key" → `STRIPE_SECRET_KEY`
2. **Developers → Webhooks → Add endpoint**:
   - URL: `https://tu-dominio.com/api/stripe-webhook`
   - Evento: `checkout.session.completed`
   - Copia el "Signing secret" → `STRIPE_WEBHOOK_SECRET`

**Qué hace cada pieza:**
- `create-checkout-session.js` crea la sesión de pago cuando alguien usa la pestaña "Internacional"
- `stripe-webhook.js` confirma el pedido y descuenta inventario automáticamente cuando Stripe avisa que el pago se completó

---

## 4. Wompi — pagos locales de Colombia (tarjeta CO, PSE, Nequi, Daviplata)

```
VITE_WOMPI_PUBLIC_KEY=pub_test_xxxxx     ← esta SÍ va en el frontend
VITE_WOMPI_ENV=sandbox                    ← cambiar a "production" cuando cobres de verdad
WOMPI_PRIVATE_KEY=prv_test_xxxxx          ← solo servidor
WOMPI_INTEGRITY_SECRET=xxxxx              ← solo servidor
WOMPI_EVENTS_SECRET=xxxxx                 ← solo servidor
WOMPI_ENV=sandbox
```

1. Cuenta en **comercios.wompi.co** (usa el ambiente sandbox mientras pruebas)
2. **Configuración → API Keys** → copia las 3 llaves (pública, privada, secreto de integridad)
3. **Configuración → Eventos** → agrega `https://tu-dominio.com/api/wompi-webhook` → copia el secreto de eventos

**Qué hace cada pieza:**
- La llave pública tokeniza la tarjeta directamente en el navegador (el número de tarjeta nunca toca tu servidor)
- `create-local-payment.js` crea la transacción en Wompi (tarjeta, PSE o Nequi/Daviplata)
- `wompi-webhook.js` confirma el pedido y descuenta inventario cuando el banco aprueba el pago

---

## 5. Checklist de despliegue en Vercel

Todas estas variables van en **Project Settings → Environment Variables**:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
VITE_WOMPI_PUBLIC_KEY
VITE_WOMPI_ENV
WOMPI_PRIVATE_KEY
WOMPI_INTEGRITY_SECRET
WOMPI_EVENTS_SECRET
WOMPI_ENV
```

Después de agregar o cambiar cualquiera, **hay que volver a desplegar**
(Vercel no las aplica a builds ya hechos).

---

## 6. Qué probar después de configurar cada cosa

- [ ] `npm run dev` → el sitio carga las 6 variedades de café (confirma que Supabase básico funciona)
- [ ] Botón de WhatsApp flotante y "Comprar" abren el chat con el número correcto
- [ ] Cambiar el número en `/admin → Configuración` y confirmar que el sitio lo refleja
- [ ] Iniciar sesión con Google desde el ícono de cuenta
- [ ] Pagar con tarjeta internacional (Stripe test card `4242 4242 4242 4242`)
- [ ] Pagar con tarjeta local (Wompi tiene tarjetas de prueba en su documentación sandbox)
- [ ] Crear tu usuario admin y entrar a `/admin`
- [ ] Confirmar un pedido de prueba en `/admin → Pedidos` y ver que el inventario baja

---

## 7. Pendiente de seguridad en tu proyecto de Supabase (no relacionado a este sitio)

Tu proyecto también tiene una tabla `public.config` (de otro trabajo, no de
AceroPress) con las políticas de seguridad **desactivadas** — cualquiera con
tu llave pública puede leerla o modificarla. Si me dices qué contiene y quién
debe poder tocarla, te armo la política correcta.

---

## 8. Lo que todavía no es automático

- **Suscripción mensual de café:** guarda la preferencia del cliente, pero no
  cobra recurrentemente todavía. Eso requiere Stripe Subscriptions (o el
  equivalente en Wompi) — es una pieza aparte si la quieres.

---

## 9. API de Acero (FastAPI)

Además de las funciones de Node (`api/*.js`: pagos, barista, asistente), el
proyecto tiene una API en **FastAPI** (Python) para datos e integraciones:

- Entrada: `api/v1.py` · código: `api/_acero/` · dependencias: `requirements.txt`.
- Todo lo que llegue a `/api/v1/*` lo atiende FastAPI (regla en `vercel.json`).
- Documentación interactiva: `https://www.aceropress.com/api/v1/docs`.
  El contrato `https://www.aceropress.com/api/v1/openapi.json` sirve para generar el
  cliente de la app Android de Micra (openapi-generator, Kotlin).

| Ruta | Qué hace |
|---|---|
| `GET /api/v1/pulse` | Carga FNC, Bolsa NY, TRM y clima de Bogotá para las cintas. `status` dice qué fuente respondió y cuál falló. |
| `GET /api/v1/bi/brief?kind=daily\|weekly` | **Algoritmo Micra** (solo owner): tablero por nivel (norte, red, negocio, redes, mercado), acciones en orden, plan de contenido y el texto listo para WhatsApp. |
| `GET/POST /api/v1/bi/tinteros` · `PATCH /api/v1/bi/tinteros/{id}` | Red de tinteros: registrar, cambiar etapa o línea base. |
| `PUT /api/v1/bi/tinteros/{id}/days/{día}` | Registrar (o corregir) el día de un tintero: tazas, precio, ingreso neto, horas. |

Las rutas de `/bi` usan la sesión del panel (`Authorization: Bearer <token>`)
y las reglas RLS de Supabase: solo la cuenta owner las ve. El algoritmo vive en
`api/_acero/bi/` (`metrics.py` = indicadores, `rules.py` = reglas → acciones,
`brief.py` = resumen y contenido). En el Panel: **Negocio → Algoritmo**.

El pulso no necesita llaves. En local:

```
pip install -r requirements.txt uvicorn
npm run api    # FastAPI en el puerto 8000
npm run dev    # el sitio; /api/v1 pasa a FastAPI
```

---

## 10. App Micra en Android e iOS (Capacitor)

La app instalable de Micra son las mismas pantallas de `/micra`, metidas en un
proyecto nativo de Android (`android/`, Gradle) y otro de iOS (`ios/`, Xcode con
Swift Package Manager, sin CocoaPods). Lo que el celular hace distinto (GPS,
compartir, entrar con Google, abrir WhatsApp o el sitio) está en
`src/features/micra-app/native/main.jsx`. Identificador: `com.aceropress.micra`.

### 10.1 Lo que necesitas en el Mac (una sola vez)

1. **Node 22** (el mismo del sitio) y `npm install` en la carpeta del repo.
2. **Xcode** (App Store). Ábrelo una vez, acepta la licencia y en
   *Settings → Components* descarga la plataforma **iOS** (trae el simulador).
   Si tienes varias versiones: `sudo xcode-select -s /Applications/Xcode.app`.
3. **Android Studio** (developer.android.com/studio). En el asistente deja el
   SDK por defecto; en *Device Manager* crea un teléfono (p. ej. Pixel 8, API 36).
   Y en `~/.zshrc`:
   ```
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
   ```
4. El mismo `.env` del sitio con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`:
   el build los mete dentro de la app (son las llaves públicas; nada privado).
5. **Supabase → Authentication → URL Configuration → Redirect URLs**: agrega
   `com.aceropress.micra://auth`. Es por donde Google devuelve a la persona a la
   app después de entrar; sin eso, «Entrar con Google» se queda en el navegador.

### 10.2 Correrla

| Desde | iPhone (simulador) | Android (emulador) |
|---|---|---|
| Terminal de VS Code | `npm run micra:ios` | `npm run micra:android` |
| VS Code, sin terminal | ⇧⌘P → *Tasks: Run Task* → «Micra: iPhone (simulador)» | ⇧⌘P → *Tasks: Run Task* → «Micra: Android (emulador)» |
| El IDE nativo | `npm run micra:xcode` y ▶ en Xcode | `npm run micra:studio` y ▶ en Android Studio |

`micra:ios` / `micra:android` compilan la web de Micra (`vite.micra.config.js` →
`dist-micra/`), la copian a los dos proyectos (`cap sync`) y preguntan en qué
simulador o emulador abrirla. La primera vez Xcode baja los paquetes de Capacitor
(unos minutos, necesita internet). Cada cambio en `src/` necesita volver a correr
el comando.

VS Code recomienda la extensión **Ionic** (`.vscode/extensions.json`): agrega un
panel con *Run On iOS* / *Run On Android* y la lista de simuladores.

### 10.3 Iconos y pantalla de arranque

Salen del kit `icono-micra/` (la lata Día; Noche y Teñida para el modo oscuro y
teñido de iOS 18; frente adaptativo y una tinta para Android 13+). Ya están en
`ios/App/App/Assets.xcassets/` y `android/app/src/main/res/mipmap-*`. Para
cambiarlos por el termo, reemplaza esos PNG con los de `icono-micra/termo/`
(mismos nombres y tamaños).

### 10.4 Lo que falta para las tiendas

- **App Store**: cuenta de Apple Developer (USD 99/año), elegir el *Team* en
  Xcode (*Signing & Capabilities*), *Product → Archive* y subir a TestFlight.
- **Google Play**: cuenta de desarrollador (USD 25, una vez), una llave de firma
  (*Build → Generate Signed App Bundle*) y subir el `.aab` a prueba interna.
- Cuando estén, sus enlaces van en `app_config` `app_store_url` / `play_store_url`
  y los botones de la portada dejan de decir «Pronto».
- Enlaces `https://www.aceropress.com/micra/...` que abran la app (Universal
  Links / App Links) necesitan el Team ID de Apple y la huella de la llave de
  Android; hoy esos enlaces abren la web y la app solo responde a
  `com.aceropress.micra://`.
