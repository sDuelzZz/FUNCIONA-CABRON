# 09 — Teoría: PWA, Service Workers y códigos QR

> Lee esto antes de tocar código. Si entiendes esto, el código del siguiente apunte tiene todo el sentido.

---

## ¿Qué es una PWA?

PWA son las siglas de **Progressive Web App** (Aplicación Web Progresiva). Es una web normal que, con unas pocas adiciones, se comporta como una app nativa instalada en el móvil.

El usuario la abre en el navegador como siempre, pero si la visita varias veces, el navegador le ofrece instalarla. Una vez instalada:

- Aparece en la pantalla de inicio como cualquier otra app
- Se abre sin barra de navegación, como una app de verdad
- Funciona sin conexión (o con conexión limitada)
- Puede recibir notificaciones push

Lo importante es que **no hay que ir a la App Store ni a Google Play**. La web se instala directamente desde el navegador.

---

## Las dos piezas de una PWA

Una PWA necesita exactamente dos cosas:

### 1. El manifest

Un archivo JSON que describe la app: su nombre, icono, color de fondo, y cómo debe abrirse.

```json
{
  "name": "Flex — Live Sessions",
  "short_name": "Flex",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#09090b",
  "theme_color": "#09090b",
  "icons": [...]
}
```

- `display: "standalone"` es lo que hace que la app se abra sin barra del navegador
- `start_url` es la primera página que se abre al pulsar el icono
- `theme_color` es el color de la barra de estado del móvil

### 2. El Service Worker

Un Service Worker es un **script de JavaScript que se ejecuta en segundo plano**, separado de la página. No tiene acceso al DOM, pero puede interceptar peticiones de red.

Su función principal es hacer que la app funcione sin conexión: cuando el usuario pide una página, el Service Worker puede devolvérsela desde una caché local en vez de ir a internet.

```
Sin Service Worker:
  Navegador ──── petición ────▶ Servidor
  Navegador ◀─── respuesta ─── Servidor

Con Service Worker:
  Navegador ──── petición ────▶ Service Worker
                                    │
                             ¿Está en caché?
                            Sí ──────────────▶ Navegador (instantáneo)
                            No ──── red ─────▶ Servidor ──▶ Navegador
                                    │
                             (también lo guarda en caché)
```

### ¿Y `next-pwa`?

Configurar un Service Worker a mano es complejo. La librería `next-pwa` lo genera automáticamente a partir de tu configuración. Tú le dices qué rutas cachear y ella se encarga del resto.

**¿Cuándo crea el archivo `sw.js`?**

`next-pwa` no genera el Service Worker hasta que haces un build de producción. El ciclo es:

1. **Durante desarrollo** (`next dev`) — el Service Worker está desactivado (`disable: process.env.NODE_ENV === 'development'`). No existe ningún archivo `sw.js`. Esto es intencionado: el caché no debe interferir mientras desarrollas.

2. **Al hacer `next build`** — `next-pwa` genera automáticamente estos archivos en tu carpeta `public/`:
   - `sw.js` — el Service Worker real
   - `workbox-xxxxxxxx.js` — la librería de caché que usa internamente

3. **En producción** (`next start` o un despliegue) — el navegador descarga e instala `sw.js`, y desde ahí gestiona el caché y la experiencia offline.

El Service Worker no existe como archivo en el repositorio porque se genera en tiempo de build. Para verlo localmente, ejecuta `next build` y aparecerá en `public/sw.js`.

---

## El ciclo de vida del Service Worker

Un Service Worker pasa por tres fases que es importante entender:

```
1. INSTALL — se descarga e instala en segundo plano
        ↓
2. ACTIVATE — entra en funcionamiento (la versión anterior se descarta)
        ↓
3. FETCH — intercepta todas las peticiones de red de la app
```

Con `skipWaiting: true` le decimos que salte directamente de INSTALL a ACTIVATE, sin esperar a que el usuario cierre y abra la app. Esto es lo habitual en desarrollo.

---

## ¿Qué es un código QR?

Un código QR (**Q**uick **R**esponse) es una imagen que codifica texto. Un teléfono apuntando con la cámara puede leer ese texto instantáneamente.

En nuestro caso el texto codificado es el `qr_token` de la reserva — un UUID generado en el webhook de Stripe cuando se confirma el pago:

```
qr_token = "a3f8c2d1-7e4b-4f9a-b5c3-8d1e2f3a4b5c"
```

El QR es simplemente ese UUID convertido en imagen. El portero escanea la imagen, su teléfono lee el UUID, y nosotros lo buscamos en la base de datos para saber si es válido.

---

## ¿Cómo se genera un QR en el navegador?

La librería `qrcode` convierte cualquier texto en un código QR dibujado en un elemento `<canvas>` de HTML:

```js
import QRCode from 'qrcode'

// Dibuja el QR en el canvas
QRCode.toCanvas(canvasElement, 'el-texto-a-codificar', opciones)
```

Un `<canvas>` es un elemento HTML donde se puede dibujar con JavaScript. La librería pinta los cuadraditos del QR píxel a píxel dentro de ese canvas.

---

## ¿Cómo se lee un QR con la cámara del móvil?

La librería `html5-qrcode` abre la cámara del dispositivo directamente en el navegador usando la API `getUserMedia`. Esta API es parte del estándar web — no hace falta ninguna app nativa.

```
1. La página pide permiso de cámara al navegador
        ↓
2. El navegador muestra el aviso de permiso al usuario
        ↓
3. El usuario acepta
        ↓
4. La librería abre el stream de vídeo en la página
        ↓
5. Cada fotograma se analiza buscando un QR
        ↓
6. Cuando lo encuentra, llama a tu función con el texto leído
```

Solo necesitas darle al usuario un botón para activarlo. Una vez en marcha, la detección es automática y en tiempo real.

---

## Server Actions: consultas seguras desde el cliente

En React, si un componente cliente necesita datos de la base de datos, la forma habitual es hacer un `fetch` a una API. Next.js ofrece una alternativa más limpia: los **Server Actions**.

Un Server Action es una función marcada con `'use server'` que:

- Se define en el servidor
- Se llama desde el cliente como si fuera una función normal
- Next.js la convierte automáticamente en una petición HTTP por debajo

```js
// lib/actions/portero.js
'use server'
export async function verificarEntrada(token) {
  // Esta función solo se ejecuta en el servidor
  const { data } = await supabase.from('reservas').select('...').eq('qr_token', token)
  return { valido: data?.estado_pago === 'pagado' }
}

// porteros/page.jsx (componente cliente)
'use client'
import { verificarEntrada } from '@/lib/actions/portero'

const resultado = await verificarEntrada(token) // parece local, es una petición al servidor
```

La ventaja es que la conexión a Supabase y la clave de servicio nunca salen del servidor. El cliente solo envía el token y recibe el resultado.

---

## useTransition: llamadas asíncronas sin bloquear la UI

Cuando llamas a un Server Action desde el cliente, la petición tarda un momento. Con `useTransition` puedes saber si hay una petición en curso y deshabilitar el botón mientras esperas, sin que la página se quede congelada:

```js
const [isPending, startTransition] = useTransition()

function escanear(token) {
  startTransition(async () => {
    const resultado = await verificarEntrada(token)
    // actualizar estado con el resultado
  })
}
```

- `isPending` es `true` mientras la petición está en curso
- `startTransition` envuelve el código asíncrono que no debe bloquear la UI

---

## Flujo completo: de la reserva a la puerta

```text
Usuario                    Base de datos              Portero
   │                             │                       │
   │── reserva sala ────────────▶│ estado_pago=pendiente  │
   │                             │                       │
   │── paga en Stripe ──────────▶│ (webhook llega)        │
   │                             │ estado_pago=pagado     │
   │                             │ qr_token=uuid()        │
   │                             │                       │
   │── /mi-area ────────────────▶│ lee qr_token           │
   │◀── botón "Ver entrada" ─────│                       │
   │                             │                       │
   │── /entrada/[token] ────────▶│ lee reserva por token  │
   │◀── QR dibujado en pantalla ─│                       │
   │                             │                       │
   │   (muestra el móvil)        │                       │
   │────────────────────────────────────────────────────▶│
   │                             │◀── verificarEntrada() ─│
   │                             │──── resultado ────────▶│
   │                             │                  Verde/Rojo
```

---

## Resumen en una frase

El webhook de Stripe genera un token único por reserva → ese token se convierte en QR para el usuario → el portero escanea el QR con la cámara → el servidor comprueba en la base de datos si es válido.

---

## Ejercicios

---

### Ejercicio 1 — Las dos piezas de una PWA

¿Qué dos archivos/elementos son imprescindibles para que una web sea considerada una PWA instalable?

Explica con tus palabras para qué sirve cada uno.

<details>
<summary>Ver respuesta</summary>

1. **El manifest** (`manifest.json`) — describe la app: nombre, icono, colores, comportamiento al abrirse. Es lo que usa el navegador para "empaquetar" la app cuando el usuario la instala.

2. **El Service Worker** — un script en segundo plano que intercepta las peticiones de red y las puede servir desde caché. Es lo que permite que la app funcione sin conexión.

</details>

---

### Ejercicio 2 — El Service Worker

Un usuario instala la PWA de Flex en su móvil. Al día siguiente, en el metro sin cobertura, abre la app.

1. ¿Qué ocurre sin Service Worker?
2. ¿Qué ocurre con Service Worker y las páginas cacheadas?
3. ¿Puede ver sus reservas sin conexión? ¿Por qué?

<details>
<summary>Ver respuesta</summary>

1. Sin Service Worker, el navegador intenta ir al servidor, no puede, y muestra la página de error de red ("Sin conexión").

2. Con Service Worker, las páginas que se cachearon en visitas anteriores se sirven desde el almacenamiento local del dispositivo, sin tocar la red.

3. Depende. Las páginas estáticas (HTML, CSS, JS) sí se pueden cachear. Pero los datos de las reservas vienen de Supabase — esas peticiones de API no se cachean por defecto, así que los datos no estarán disponibles. La app carga, pero sin datos actualizados.

</details>

---

### Ejercicio 3 — El código QR

Tenemos este `qr_token` en la base de datos:

```
a3f8c2d1-7e4b-4f9a-b5c3-8d1e2f3a4b5c
```

1. ¿Qué texto contiene el QR que se genera?
2. Si alguien fotografía el QR y lo comparte, ¿puede otra persona usarlo para entrar?
3. ¿Cómo evitarías ese problema?

<details>
<summary>Ver respuesta</summary>

1. El QR contiene exactamente ese UUID: `a3f8c2d1-7e4b-4f9a-b5c3-8d1e2f3a4b5c`.

2. Sí, con la implementación básica podría. El token es el único factor de verificación — quien lo tenga puede pasar.

3. Soluciones posibles:
   - Marcar la reserva como `'completada'` en cuanto el portero la valida, para que no se pueda usar dos veces (Reto 2 de los apuntes).
   - Añadir verificación de identidad: que el portero compruebe también el nombre del titular.
   - Tokens con expiración corta: regenerar el QR cada X minutos para que una captura de pantalla antigua no sirva.

</details>

---

### Ejercicio 4 — Server Actions vs API Routes

Tienes dos opciones para que el portero verifique una entrada:

**Opción A:** Crear una API Route (`/api/verificar`) que reciba el token y devuelva el resultado.

**Opción B:** Usar un Server Action (`verificarEntrada(token)`).

1. ¿Qué diferencia hay en cómo se llaman desde el componente cliente?
2. ¿Cuál da más garantías de seguridad y por qué?
3. ¿Cuándo usarías la Opción A en vez de la B?

<details>
<summary>Ver respuesta</summary>

1. La API Route se llama con `fetch('/api/verificar', { method: 'POST', body: ... })`. El Server Action se llama como una función normal: `await verificarEntrada(token)`.

2. Ambas ejecutan código en el servidor, así que la seguridad es equivalente. La ventaja del Server Action es que Next.js gestiona automáticamente la serialización y el endpoint — hay menos superficie de error.

3. La API Route tiene sentido cuando necesitas un endpoint que no sea Next.js quien lo consume — por ejemplo, si un servicio externo (Stripe, un webhook, una app móvil nativa) necesita llamar a tu endpoint directamente.

</details>

---

### Ejercicio 5 — useTransition

Un compañero escribe este código para llamar al Server Action:

```jsx
async function escanear(token) {
  setLoading(true)
  const res = await verificarEntrada(token)
  setResultado(res)
  setLoading(false)
}
```

Y tú propones usar `useTransition` en su lugar. ¿Cuál es la diferencia práctica para el usuario?

<details>
<summary>Ver respuesta</summary>

La diferencia principal es que `useTransition` no bloquea las actualizaciones urgentes de la UI. Si con `useState` el usuario pulsa el botón y la petición tarda 2 segundos, React puede quedar "ocupado" procesando la transición y no responder a otras interacciones.

Con `useTransition`, React marca esa actualización como "no urgente" y sigue siendo capaz de responder a clics, scroll, etc., mientras la petición está en vuelo. Además, `isPending` es más fiable que un `loading` manual porque React lo gestiona solo — no hay riesgo de que se quede `true` si hay un error.

</details>

---

## Navegación

[← 08 — Teoría: Edge Functions](./08-teoria-edge-functions.md) · [09 — Código: PWA y entradas QR →](../09-pwa-y-entradas-qr.md)
