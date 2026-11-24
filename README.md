# WhatsApp Autoreply

Prueba de concepto de un bot que contesta mensajes entrantes con la [WhatsApp Cloud API](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages) de Meta.

Sirve de dos maneras, sin cambiar el código del bot:

- **Servicio aparte.** `npm start` levanta un proceso HTTP con el webhook.
- **Pieza de otro proyecto.** Importás `createWhatsAppBot` y lo montás en un servidor que ya exista.

No tiene dependencias de runtime. Corre en Node 20 o superior.

## Estado

Esto es una base para refinar, no un producto cerrado. El comportamiento de hoy es deliberadamente chico: verifica el webhook, lee el mensaje de texto y responde. Las decisiones que todavía hay que cerrar están en [docs/decisiones.md](docs/decisiones.md).

Hoy hace esto:

- Responde el `GET` de verificación de Meta.
- Recibe el `POST` del webhook y se queda con los mensajes de usuario.
- Valida `X-Hub-Signature-256` cuando `WHATSAPP_APP_SECRET` está definido.
- Evita contestar dos veces el mismo `id` de mensaje, en memoria y solo mientras el proceso vive.
- Llama a un handler reemplazable. Si no pasás uno, devuelve el mismo texto.

Hoy no hace esto:

- No envía plantillas, botones, listas, imágenes ni documentos.
- No guarda conversaciones ni sobrevive a un reinicio.
- No atiende varios números ni varias cuentas.
- No marca el mensaje como leído.

## Cómo correrlo solo

```bash
cp .env.example .env
npm start
```

`npm start` escucha `GET` y `POST` en `/webhook`, y `GET /health` para saber si el proceso está vivo.

Meta tiene que poder llegar a esa URL por HTTPS. En local hace falta un túnel (ngrok, Cloudflare Tunnel o el que ya uses). En el panel de la app, la URL de callback es `https://<tu-host>/webhook` y el verify token es el mismo valor que `WHATSAPP_VERIFY_TOKEN`.

El ejemplo con un saludo propio es:

```bash
npm run start:example
```

## Cómo incluirlo en otro proyecto

El paquete exporta `createWhatsAppBot`. El handler recibe el mensaje normalizado y devuelve el texto a enviar. Si no devuelve nada, el bot no contesta.

```js
import { createWhatsAppBot } from './src/index.js'

const bot = createWhatsAppBot({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  async onMessage(message) {
    if (message.type !== 'text') return
    return { text: `Recibimos: ${message.text}` }
  },
})
```

En un `http.Server` que ya exista, el resto de las rutas sigue siendo de la app:

```js
server.on('request', (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/webhook') return bot.handleNodeRequest(req, res)
})
```

`bot.client.sendText(to, body)` queda disponible para enviar fuera del ciclo del webhook. Dentro de la ventana de atención conviene devolver la respuesta desde `onMessage`.

Detalle de variables, Docker y el contrato del handler: [docs/integracion.md](docs/integracion.md). Flujo y piezas internas: [docs/arquitectura.md](docs/arquitectura.md).

## Variables

| Variable | Uso |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Token de la app de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número, no el teléfono |
| `WHATSAPP_VERIFY_TOKEN` | Secreto que elegís vos para el alta del webhook |
| `WHATSAPP_APP_SECRET` | App Secret. Sin este valor no se valida la firma |
| `WHATSAPP_API_VERSION` | Versión del Graph API. Default `v27.0` |
| `PORT` | Puerto del proceso. Default `3000` |
| `WEBHOOK_PATH` | Ruta del webhook. Default `/webhook` |

## Pruebas

```bash
npm test
```

Cubren la verificación, el eco, un handler propio, el duplicado, la firma, un fallo reintentable y `/health`. No llaman a Meta.

## Estructura

```
src/index.js      API pública
src/bot.js        webhook, handler y servidor
src/client.js     POST a /messages
src/parse.js      webhook de Meta -> mensaje normalizado
src/server.js     entrada del proceso independiente
examples/         una respuesta distinta a la de eco
docs/             arquitectura, integración y decisiones abiertas
```
