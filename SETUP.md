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
