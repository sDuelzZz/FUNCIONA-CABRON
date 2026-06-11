# 09 — PWA y Entradas QR

> **Proyecto Flex** · Stack: Next.js · Supabase · Stripe  
> Antes de continuar, deberías haber terminado el apunte 07 (Stripe). El QR de entrada nace exactamente en ese punto.

---

## ¿Qué vamos a conseguir?

Ahora mismo, cuando el usuario paga una reserva:

1. Stripe confirma el pago
2. El webhook actualiza `estado_pago = 'pagado'` en la tabla `reservas`
3. Y también genera un `qr_token` — un código único que se guarda en `reservas.qr_token`

Pero ese `qr_token` no lo ve nadie. La página de éxito ya dice "Tu entrada con código QR ya está disponible en tu perfil", pero el perfil todavía no muestra ningún QR.

En este apunte vamos a:

1. **Convertir la app en PWA** — para que el usuario pueda instalarla en el móvil como si fuera una app nativa
2. **Mostrar el código QR de la entrada** — a partir del `qr_token` que ya existe en la base de datos
3. **Conectar la página del portero** — para que valide entradas reales en vez de datos inventados

```text
Lo que ya existe:          Lo que vamos a construir:
─────────────────          ──────────────────────────
reservas.qr_token    ──▶   Componente QR visual
/reserva/exito       ──▶   Enlace a la entrada
/porteros (estático) ──▶   /porteros conectado a Supabase
                     ──▶   manifest.json (PWA)
```

---

## Paso 1 — Convertir la app en PWA

Una **PWA** (Progressive Web App) es una web que el móvil puede instalar como si fuera una app nativa: tiene icono en la pantalla de inicio, se abre sin barra del navegador, y puede funcionar sin conexión.

Para Flex tiene sentido: el cliente entra al local, saca el móvil, abre su entrada QR. Si tiene la PWA instalada, lo hace en dos toques desde la pantalla de inicio, sin buscar el navegador ni la URL.

```text
Web normal:   Usuario ──▶ Abre Chrome ──▶ Escribe la URL ──▶ Ve el QR
PWA:          Usuario ──▶ Toca el icono de Flex ──▶ Ve el QR
```

### 1.1 Instalar next-pwa

```bash
npm install next-pwa
```

### 1.2 Modificar next.config

Envuelve la configuración con `withPWA`. La opción `disable: process.env.NODE_ENV === 'development'` es importante: el Service Worker interfiere con el hot reload de Next.js en local, así que solo lo activamos en producción.

### 1.3 Crear el manifest

El manifest es un archivo JSON en `public/manifest.json` que le dice al navegador cómo instalar la PWA: nombre, icono, color de la barra de estado, y que se abra sin barra de navegador (`"display": "standalone"`).

### 1.4 Enlazar el manifest en el layout

En `apps/web/src/app/layout.jsx`, añade `manifest: '/manifest.json'` al objeto `metadata` que ya existe.

### ¿Cómo verificar que funciona?

Despliega en Vercel (el Service Worker requiere HTTPS). Luego en Chrome del móvil aparecerá un banner "Añadir a la pantalla de inicio". En desktop: DevTools → Application → Manifest.

---

## Paso 2 — El código QR de la entrada

### ¿Qué es el qr_token y de dónde viene?

Cuando el usuario paga, el webhook de Stripe llama a `crypto.randomUUID()` y guarda ese valor en `reservas.qr_token`. La columna tiene `unique`, así que dos reservas nunca pueden tener el mismo token.

**El QR no es más que una forma visual de representar una URL** que incluye ese token:

```text
https://flex.vercel.app/entrada/a3f8b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c
```

El portero escanea el QR → el móvil abre esa URL → la app comprueba en Supabase si el token es válido.

### 2.1 Instalar la librería de QR

```bash
npm install qrcode
```

### 2.2 Crear el componente EntradaQR

`apps/web/src/components/EntradaQR.jsx` recibe el `qr_token` y dibuja el código QR en un `<canvas>` usando `QRCode.toCanvas`. Necesita `'use client'` porque usa `useEffect` y accede a `window.location`.

### 2.3 Crear la página de la entrada

`apps/web/src/app/entrada/[token]/page.jsx` busca en Supabase la reserva con ese `qr_token`. Si no existe o no está pagada, muestra error. Si sí existe, compara la hora actual con los campos `inicio` y `fin` para mostrar **ENTRADA VÁLIDA** o **FUERA DE HORARIO**.

### 2.4 Mostrar el enlace a la entrada desde Mi Área

En `MiAreaClient.jsx`, donde se renderizan las reservas, añade un enlace a `/entrada/[qr_token]` condicionado a que `reserva.qr_token` no sea `null`. Ese campo solo existe cuando `estado_pago = 'pagado'`, así que el enlace solo aparece en reservas completadas.

Asegúrate también de incluir `qr_token` y `estado_pago` en el `select` de la query de `/mi-area`.

---

## Paso 3 — Conectar la página del portero

La página `/porteros` ya existe pero es completamente estática: tiene datos de prueba y valida si el código empieza por "FLEX-", que no tiene nada que ver con nuestra base de datos.

Vamos a conectarla a Supabase para que valide el `qr_token` real.

### ¿Cómo funciona la validación?

El portero escribe o escanea el token. La app busca en Supabase si existe una reserva con ese `qr_token` que:

1. Tenga `estado_pago = 'pagado'`
2. Esté en el rango horario correcto (entre `inicio` y `fin`)

Si las dos condiciones se cumplen, la entrada es válida.

### 3.1 Crear la Server Action de verificación

`apps/web/src/lib/actions/portero.js` exporta la función `verificarEntrada(token)`. Busca la reserva en Supabase y devuelve `{ valida: true, cliente, sala, inicio, fin }` o `{ valida: false, motivo }`. Permite entrada **15 minutos antes** del inicio para dar margen al portero.

### 3.2 Actualizar la página del portero

`apps/web/src/app/porteros/page.jsx` reemplaza la lógica estática por llamadas a `verificarEntrada`. Muestra el resultado en verde o rojo y guarda un historial de las últimas 20 validaciones en estado local.

### 3.3 Escanear con la cámara del móvil

```bash
npm install html5-qrcode
```

El componente `CamaraScanner.jsx` usa `Html5QrcodeScanner` para abrir la cámara del móvil en el navegador y detectar el QR en tiempo real. Cuando lo detecta, llama a `onScan(token)` — la misma función que ya teníamos para el modo manual.

Puntos clave:

- `useRef` evita que el scanner se monte dos veces (React monta los efectos dos veces en modo estricto).
- `supportedScanTypes: [0]` activa solo la cámara, sin la opción de subir imagen.
- El navegador pedirá permiso de cámara la primera vez. En móvil usa automáticamente la cámara trasera.

En `porteros/page.jsx` añades un toggle Cámara / Manual y montas el componente solo cuando el modo es `'camara'`.

### 3.4 Proteger la página por rol

Esta parte **ya está hecha**. El middleware en `proxy.js` comprueba el rol del usuario antes de dejarle entrar a `/porteros`. No tienes que añadir nada en la página.

---

## Flujo completo

```text
1. Usuario reserva una sala
        │
        ▼
2. Paga en Stripe
        │
        ▼
3. Webhook recibe checkout.session.completed
   → estado_pago = 'pagado'
   → qr_token = crypto.randomUUID()   ← se guarda en reservas
        │
        ▼
4. Usuario va a /mi-area
   → Ve sus reservas
   → Si hay qr_token → aparece el botón "Ver entrada QR"
        │
        ▼
5. Usuario pulsa "Ver entrada QR"
   → Va a /entrada/[token]
   → Se muestra el QR y los datos de la reserva
        │
        ▼
6. En la puerta: el portero abre /porteros
   → Escanea / pega el token
   → La Server Action busca en Supabase
   → Verde si está pagada y en horario, rojo si no
```

---

## Probar en local

1. Haz una reserva y completa el pago (tarjeta de prueba `4242 4242 4242 4242`)
2. El webhook de Stripe tiene que estar corriendo con `stripe listen`
3. Ve a `/mi-area` — deberías ver el enlace "Ver entrada QR"
4. Entra en `/entrada/[token]` — verás el QR y los datos
5. Copia el token de la URL
6. Ve a `/porteros`, pégalo y pulsa buscar

Si el pago se realizó correctamente y el portero verifica dentro del rango horario, verás "ENTRADA VÁLIDA" en verde.

---

## Reto

1. **Botón de descarga** — añade al componente `EntradaQR` un botón que use `canvas.toDataURL('image/png')` para generar un enlace de descarga con el QR en alta resolución.

2. **Marcar como usada** — cuando el portero valida una entrada correctamente, actualiza el campo `estado` de la reserva a `'completada'` en Supabase, para que no se pueda volver a usar el mismo QR. Asegúrate también de añadir esa comprobación en `verificarEntrada`.

3. **Shortcut en el manifest** — añade un shortcut en `manifest.json` para que los usuarios con la PWA instalada puedan ir directamente a `/mi-area` desde el icono de la app.

---

## Navegación

[← 08 — Teoría: Edge Functions](./teoria/08-teoria.md) · [10 — Realtime y Vercel →](./10-realtime-y-vercel.md)
