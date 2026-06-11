# 09 — PWA y Entradas QR

> **Proyecto Flex** · Stack: Next.js · Supabase · Stripe  
> Antes de continuar, deberías haber terminado el apunte 07 (Stripe). El QR de entrada nace exactamente en ese punto.

---

## ¿Qué vamos a conseguir?

Ahora mismo, cuando el usuario paga una reserva:

1. Stripe confirma el pago
2. El webhook actualiza `estado_pago = 'pagado'` en la tabla `reservas`
3. Y también genera un `qr_token` — un código único que se guarda en `reservas.qr_token`

Pero ese `qr_token` no lo ve nadie. La página de éxito (`/reserva/exito`) ya dice "Tu entrada con código QR ya está disponible en tu perfil", pero el perfil todavía no muestra ningún QR.

En este apunte vamos a:

1. **Convertir la app en PWA** — para que el usuario pueda instalarla en el móvil como si fuera una app nativa
2. **Mostrar el código QR de la entrada** — a partir del `qr_token` que ya existe en la base de datos
3. **Conectar la página del portero** — para que valide entradas reales en vez de datos inventados

```
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

```
Web normal:   Usuario ──▶ Abre Chrome ──▶ Escribe la URL ──▶ Ve el QR
PWA:          Usuario ──▶ Toca el icono de Flex ──▶ Ve el QR
```

### 1.1 Instalar next-pwa

Desde la carpeta `apps/web/`:

```bash
npm install next-pwa
```

### 1.2 Modificar next.config

Abre `apps/web/next.config.mjs` y envuelve la configuración con `withPWA`:

```js
// apps/web/next.config.mjs
import withPWAInit from 'next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...tu configuración que ya tenías (images, remotePatterns, etc.)
}

export default withPWA(nextConfig)
```

> `disable: process.env.NODE_ENV === 'development'` es importante: el Service Worker interfiere con el hot reload de Next.js en local. Solo lo activamos en producción.

### 1.3 Crear el manifest

El manifest es un archivo JSON que le dice al navegador cómo instalar la PWA: cómo se llama, qué icono usar, de qué color es la barra de estado...

Crea el archivo `apps/web/public/manifest.json`:

```json
{
  "name": "Flex Underground",
  "short_name": "Flex",
  "description": "Tu sala de Jam Sessions en el bolsillo",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#e63946",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

> Por ahora puedes usar cualquier imagen de 192×192 y 512×512 píxeles y guardarlas en `apps/web/public/icons/`. Más adelante puedes generar los iconos con el diseño oficial de Flex.

### 1.4 Enlazar el manifest en el layout

El layout ya existe en `apps/web/src/app/layout.jsx`. Solo hay que añadir la referencia al manifest:

```jsx
// apps/web/src/app/layout.jsx
export const metadata = {
  // ...lo que ya tenías
  manifest: '/manifest.json',
}
```

### ¿Cómo verificar que funciona?

Despliega en Vercel (o usa un túnel como ngrok en local, ya que el Service Worker requiere HTTPS). Luego:

1. Abre Chrome en el móvil
2. Entra en la URL de la app
3. Chrome mostrará un banner "Añadir a la pantalla de inicio" (o estará en el menú del navegador)
4. En desktop: Chrome DevTools → Application → Manifest — tiene que aparecer sin errores

---

## Paso 2 — El código QR de la entrada

### ¿Qué es el qr_token y de dónde viene?

Cuando el usuario paga una reserva, el webhook de Stripe ejecuta esto:

```js
// apps/web/src/app/api/webhook/route.js  (ya existe)
await supabase
  .from('reservas')
  .update({
    estado_pago:    'pagado',
    stripe_payment: session.payment_intent,
    qr_token:       crypto.randomUUID(),  // ← aquí se genera
  })
  .eq('id', id)
  .eq('estado_pago', 'pendiente')
```

`crypto.randomUUID()` genera un identificador único como `a3f8b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c`. Ese valor se guarda en `reservas.qr_token`. La columna tiene `unique` en el esquema, así que dos reservas nunca pueden tener el mismo token.

**El QR no es más que una forma visual de representar una URL** que incluye ese token:

```
https://flex.vercel.app/entrada/a3f8b2c1-4d5e-6f7a-8b9c-0d1e2f3a4b5c
```

El portero escanea el QR → el móvil abre esa URL → la app comprueba en Supabase si el token es válido.

### 2.1 Instalar la librería de QR

```bash
npm install qrcode
```

### 2.2 Crear el componente EntradaQR

Este componente recibe el `qr_token` y dibuja el código QR en un `<canvas>`:

```jsx
// apps/web/src/components/EntradaQR.jsx
'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function EntradaQR({ token }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!token || !canvasRef.current) return

    const url = `${window.location.origin}/entrada/${token}`

    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 2,
      color: {
        dark:  '#ffffff',
        light: '#18181b',
      },
    })
  }, [token])

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} className="rounded-xl" />
      <p className="text-zinc-500 text-xs text-center">
        Muestra este QR en la entrada de la sala VIP
      </p>
    </div>
  )
}
```

> `QRCode.toCanvas` dibuja el QR directamente sobre el elemento `<canvas>`. El `useEffect` se ejecuta en el navegador (no en el servidor) — por eso este componente necesita `'use client'`.

### 2.3 Crear la página de la entrada

Cuando el portero escanea el QR, el móvil abre `/entrada/[token]`. Esta página tiene que:

1. Buscar en Supabase la reserva con ese `qr_token`
2. Comprobar que está pagada
3. Mostrar los datos de la reserva y el QR

```jsx
// apps/web/src/app/entrada/[token]/page.jsx
import { createClient } from '@/lib/supabase/server'
import EntradaQR from '@/components/EntradaQR'

export default async function PaginaEntrada({ params }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: reserva } = await supabase
    .from('reservas')
    .select(`
      id,
      inicio,
      fin,
      estado_pago,
      total,
      qr_token,
      salas_vip ( nombre ),
      perfiles  ( nombre )
    `)
    .eq('qr_token', token)
    .single()

  // Si no existe la reserva o no está pagada, mostramos error
  if (!reserva || reserva.estado_pago !== 'pagado') {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p className="text-xl font-bold text-red-400 mb-2">Entrada no válida</p>
        <p className="text-sm">Este código QR no corresponde a ninguna reserva pagada.</p>
      </div>
    )
  }

  const inicio = new Date(reserva.inicio)
  const fin    = new Date(reserva.fin)
  const ahora  = new Date()
  const activa = ahora >= inicio && ahora <= fin

  return (
    <div className="p-6 flex flex-col items-center gap-6 max-w-sm mx-auto text-center">
      <h1 className="text-xl font-bold text-zinc-100">Entrada Flex</h1>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full text-left space-y-2">
        <p className="text-zinc-100 font-semibold">{reserva.salas_vip.nombre}</p>
        <p className="text-zinc-400 text-sm">Titular: {reserva.perfiles.nombre}</p>
        <p className="text-zinc-400 text-sm">
          Entrada: {inicio.toLocaleString('es-ES')}
        </p>
        <p className="text-zinc-400 text-sm">
          Salida: {fin.toLocaleString('es-ES')}
        </p>
        <p className="text-gold-400 font-bold">{reserva.total} € pagados</p>
      </div>

      <div className={`w-full rounded-2xl py-3 font-bold text-lg ${
        activa
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
      }`}>
        {activa ? 'ENTRADA VÁLIDA' : 'FUERA DE HORARIO'}
      </div>

      <EntradaQR token={reserva.qr_token} />
    </div>
  )
}
```

### 2.4 Mostrar el enlace a la entrada desde Mi Área

La página `/mi-area` ya existe y muestra las reservas del usuario. Solo hay que añadir el enlace a la entrada QR cuando la reserva está pagada.

Abre `apps/web/src/components/mi-area/MiAreaClient.jsx` y busca donde se renderizan las reservas. Añade el enlace:

```jsx
// Dentro del map de reservas, añade esto si la reserva tiene qr_token:
import Link from 'next/link'

// Donde ya muestras los datos de cada reserva:
{reserva.qr_token && (
  <Link
    href={`/entrada/${reserva.qr_token}`}
    className="inline-block mt-2 px-4 py-1.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 text-xs font-bold rounded-xl"
  >
    Ver entrada QR →
  </Link>
)}
```

> `reserva.qr_token` solo existe cuando `estado_pago = 'pagado'` — el webhook solo lo genera cuando el pago se confirma. Si la reserva está pendiente, el campo es `null` y el enlace no aparece.

Pero espera: la query de `/mi-area` no está pidiendo `qr_token`. Hay que añadirlo al select:

```js
// apps/web/src/app/mi-area/page.jsx
// Cambia el select de reservas para incluir qr_token y estado_pago:
supabase
  .from('reservas')
  .select(`
    id, inicio, fin, estado, estado_pago, qr_token,
    salas_vip ( nombre, descripcion )
  `)
  .eq('cliente_id', user.id)
  .order('inicio', { ascending: false }),
```

---

## Paso 3 — Conectar la página del portero

La página `/porteros` ya existe pero es completamente estática: tiene datos de prueba inventados y la validación comprueba si el código empieza por "FLEX-", que no tiene nada que ver con nuestra base de datos.

Vamos a conectarla a Supabase para que valide el `qr_token` real.

### ¿Cómo funciona la validación?

El portero escribe o escanea el token (el UUID de la reserva). La app busca en Supabase si existe una reserva con ese `qr_token` que:

1. Tenga `estado_pago = 'pagado'`
2. Esté en el rango horario correcto (entre `inicio` y `fin`)

Si las dos condiciones se cumplen, la entrada es válida.

### 3.1 Crear la Server Action de verificación

```js
// apps/web/src/lib/actions/portero.js
'use server'

import { createClient } from '@/lib/supabase/server'

export async function verificarEntrada(token) {
  if (!token?.trim()) {
    return { valida: false, motivo: 'Token vacío' }
  }

  const supabase = await createClient()

  const { data: reserva } = await supabase
    .from('reservas')
    .select(`
      id, inicio, fin, estado_pago,
      salas_vip ( nombre ),
      perfiles  ( nombre )
    `)
    .eq('qr_token', token.trim())
    .single()

  if (!reserva) {
    return { valida: false, motivo: 'Token no encontrado' }
  }

  if (reserva.estado_pago !== 'pagado') {
    return { valida: false, motivo: 'Reserva no pagada' }
  }

  const ahora  = new Date()
  const inicio = new Date(reserva.inicio)
  const fin    = new Date(reserva.fin)

  // Permitimos entrada 15 minutos antes del inicio
  const inicioConMargen = new Date(inicio.getTime() - 15 * 60 * 1000)

  if (ahora < inicioConMargen || ahora > fin) {
    return {
      valida:  false,
      motivo:  'Fuera del horario de la reserva',
      inicio:  inicio.toLocaleString('es-ES'),
      fin:     fin.toLocaleString('es-ES'),
    }
  }

  return {
    valida:   true,
    cliente:  reserva.perfiles.nombre,
    sala:     reserva.salas_vip.nombre,
    inicio:   inicio.toLocaleString('es-ES'),
    fin:      fin.toLocaleString('es-ES'),
  }
}
```

### 3.2 Actualizar la página del portero

Reemplaza el contenido de `apps/web/src/app/porteros/page.jsx` para que use la Server Action real:

```jsx
// apps/web/src/app/porteros/page.jsx
'use client'

import { useState, useTransition } from 'react'
import { QrCode, CheckCircle, XCircle, Search } from 'lucide-react'
import { verificarEntrada } from '@/lib/actions/portero'

export default function PaginaPorteros() {
  const [codigo, setCodigo]     = useState('')
  const [resultado, setResultado] = useState(null)
  const [historial, setHistorial] = useState([])
  const [isPending, startTransition] = useTransition()

  function escanear() {
    if (!codigo.trim()) return

    startTransition(async () => {
      const res = await verificarEntrada(codigo)

      const entrada = {
        id:      Date.now(),
        codigo:  codigo.trim(),
        nombre:  res.valida ? res.cliente : 'Desconocido',
        sala:    res.valida ? res.sala    : '—',
        motivo:  res.motivo ?? null,
        hora:    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        ok:      res.valida,
      }

      setResultado(entrada)
      setHistorial(prev => [entrada, ...prev.slice(0, 19)]) // máximo 20 en historial
      setTimeout(() => setResultado(null), 5000)
      setCodigo('')
    })
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Panel de Porteros</h1>
        <p className="text-zinc-500 text-sm mt-1">Validación de entradas en puerta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scanner */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col items-center gap-6">
            <div className="w-48 h-48 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-dashed border-zinc-700">
              <QrCode size={80} className="text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm text-center">
              Pega el token del QR o escríbelo manualmente
            </p>
            <div className="w-full flex gap-2">
              <input
                placeholder="Token de la entrada (UUID)"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && escanear()}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
              />
              <button
                onClick={escanear}
                disabled={isPending}
                className="px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-zinc-950 text-sm font-semibold rounded-lg"
              >
                <Search size={16} />
              </button>
            </div>
          </div>

          {/* Resultado */}
          {resultado && (
            <div className={`rounded-2xl border p-6 flex items-center gap-4 ${
              resultado.ok
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-red-500/10 border-red-500/40'
            }`}>
              {resultado.ok
                ? <CheckCircle size={40} className="text-emerald-400 shrink-0" />
                : <XCircle    size={40} className="text-red-400 shrink-0" />
              }
              <div>
                <p className={`text-xl font-bold ${resultado.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                  {resultado.ok ? 'ENTRADA VÁLIDA' : 'ENTRADA INVÁLIDA'}
                </p>
                <p className="text-zinc-300 text-sm mt-0.5">{resultado.nombre}</p>
                <p className="text-zinc-500 text-xs">
                  {resultado.sala}
                  {resultado.motivo && ` · ${resultado.motivo}`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Últimas validaciones</h2>
          {historial.length === 0 && (
            <p className="text-zinc-600 text-sm">Aún no hay validaciones esta sesión.</p>
          )}
          <div className="space-y-2">
            {historial.map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
                {e.ok
                  ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                  : <XCircle    size={18} className="text-red-400 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-100 text-sm font-medium truncate">{e.nombre}</p>
                  <p className="text-zinc-500 text-xs">{e.sala || e.motivo}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-zinc-600 text-xs">{e.hora}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 3.3 Escanear con la cámara del móvil

El portero no debería tener que copiar y pegar el token a mano. La librería `html5-qrcode` abre la cámara del móvil directamente en el navegador y detecta el código QR en tiempo real.

```bash
npm install html5-qrcode
```

Crea el componente `src/components/portero/CamaraScanner.jsx`:

```jsx
'use client'

import { useEffect, useRef } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'

export default function CamaraScanner({ onScan }) {
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 220, height: 220 }, supportedScanTypes: [0] },
      false,
    )

    scanner.render(
      (token) => {
        scanner.clear()
        onScan(token)   // dispara verificarEntrada con el token leído
      },
      () => {},
    )

    return () => { scanner.clear().catch(() => {}) }
  }, [onScan])

  return <div id="qr-reader" className="w-full rounded-xl overflow-hidden" />
}
```

Puntos clave:

- `useRef(false)` evita que el scanner se monte dos veces en desarrollo (React monta los efectos dos veces en modo estricto).
- `supportedScanTypes: [0]` activa solo la cámara, sin la opción de subir imagen.
- Cuando detecta el QR llama a `onScan(token)` — la misma función que ya teníamos para el modo manual.

En `porteros/page.jsx` añades un toggle Cámara / Manual y montas el componente solo cuando el modo es `'camara'`:

```jsx
import CamaraScanner from '@/components/portero/CamaraScanner'
import { useCallback } from 'react'

const onScan = useCallback((token) => procesar(token), [])

// En el JSX:
{modo === 'camara' ? (
  <CamaraScanner onScan={onScan} />
) : (
  <input ... />
)}
```

> El navegador pedirá permiso de cámara la primera vez. En móvil usa automáticamente la cámara trasera.

### 3.4 Proteger la página por rol

Esta parte **ya está hecha**. El archivo `proxy.js` contiene el middleware de Next.js que comprueba el rol del usuario antes de dejarle entrar a `/porteros`. No tienes que añadir nada en la página: si alguien sin el rol correcto intenta acceder, el middleware le redirige automáticamente.

---

## Flujo completo

Así queda el flujo de principio a fin:

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

Para probar el QR en local:

1. Haz una reserva y completa el pago (con la tarjeta de prueba `4242 4242 4242 4242`)
2. El webhook de Stripe tiene que estar corriendo con `stripe listen`
3. Ve a `/mi-area` — deberías ver el enlace "Ver entrada QR"
4. Entra en `/entrada/[token]` — verás el QR y los datos
5. Copia el token de la URL
6. Ve a `/porteros`, pégalo y pulsa buscar

Si el pago se realizó correctamente y el portero verifica dentro del rango horario de la reserva, verás "ENTRADA VÁLIDA" en verde.

---

## Reto

1. **Botón de descarga** — añade al componente `EntradaQR` un botón "Descargar QR" que use `canvas.toDataURL('image/png')` para generar un enlace de descarga con el QR en alta resolución.

2. **Marcar como usada** — cuando el portero valida una entrada correctamente, actualiza el campo `estado` de la reserva a `'completada'` en Supabase, para que no se pueda volver a usar el mismo QR.

   > Pista: en la Server Action `verificarEntrada`, tras comprobar que la entrada es válida, añade:

   ```js
   await supabase.from('reservas').update({ estado: 'completada' }).eq('id', reserva.id)
   ```

   Y en la comprobación añade también que `estado !== 'completada'`.

3. **Shortcut en el manifest** — añade un shortcut en `manifest.json` para que los usuarios con la PWA instalada puedan ir directamente a `/mi-area` desde el icono:

   ```json
   "shortcuts": [
     {
       "name": "Mis entradas",
       "url": "/mi-area",
       "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
     }
   ]
   ```

---

## Navegación

[← 08 — Teoría: Edge Functions](./teoria/08-teoria.md) · [10 — Realtime y Vercel →](./10-realtime-y-vercel.md)
