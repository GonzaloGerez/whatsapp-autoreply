# Integración

## Servicio aparte

```bash
cp .env.example .env
npm start
```

El proceso lee `.env` solo para claves que no estén ya en el entorno. Una variable exportada en el sistema gana sobre el archivo.

Rutas del proceso:

| Método y ruta | Respuesta |
| --- | --- |
| `GET /webhook` | Challenge de Meta, o `403` |
| `POST /webhook` | `200` si el lote se procesó, `401` si la firma no cierra, `500` si Meta rechazó el envío |
| `GET /health` | `{ "ok": true }` |

La imagen de Docker hace lo mismo y no instala paquetes:

```bash
docker build -t whatsapp-autoreply .
docker run --rm -p 3000:3000 --env-file .env whatsapp-autoreply
```

## Dentro de otra app

Instalación prevista, cuando este repo se publique como paquete o se referencie por git:

```bash
npm install github:GonzaloGerez/whatsapp-autoreply
```

Hasta entonces se puede copiar `src/` o apuntar el `import` al checkout.

```js
import http from 'node:http'
import { createWhatsAppBot, loadConfig, loadEnvFile } from 'whatsapp-autoreply'

loadEnvFile()
const config = loadConfig()

const bot = createWhatsAppBot({
  ...config,
  async onMessage(message, ctx) {
    if (message.type !== 'text' || !message.text) return

    const answer = await miReglaDeNegocio(message)
    if (!answer) return

    return { text: answer }
  },
})

const server = http.createServer((req, res) => {
  const path = new URL(req.url || '/', 'http://localhost').pathname
  if (path === config.webhookPath) {
    bot.handleNodeRequest(req, res)
    return
  }
  res.writeHead(404)
  res.end()
})

server.listen(config.port)
```

`ctx.client` es el cliente de envío, por si la regla necesita mandar algo que no es la respuesta directa del mensaje. Para el caso común, devolver `{ text }` alcanza.

Express, Fastify u otro framework pueden reenviar la misma `req` y `res` de Node. No hace falta un adaptador propio mientras el framework no haya consumido el body antes: la firma se calcula sobre los bytes originales.

## Contrato de `onMessage`

```ts
onMessage(message, ctx) => string | { text: string } | Array<...> | void
```

| Campo | Significado |
| --- | --- |
| `message.id` | Id de Meta. Sirve para dedupe y para logs |
| `message.from` | Número del usuario, sin `+` |
| `message.name` | Nombre de perfil, si Meta lo mandó |
| `message.type` | `text`, `image`, `audio`, `interactive`, etc. |
| `message.text` | Solo presente cuando `type` es `text` |
| `message.phoneNumberId` | Número de la cuenta que recibió el mensaje |
| `message.raw` | Objeto original, para tipos que esta PoC todavía no interpreta |
| `ctx.client.sendText(to, body)` | Envío directo |
| `ctx.phoneNumberId` | Número configurado en este proceso |

El handler por defecto, el de `npm start`, devuelve el mismo texto. `examples/custom-reply.js` muestra un saludo con el nombre del perfil.

## Alta en Meta

Checklist mínimo del panel de la app:

1. Agregar el producto WhatsApp y quedarse con el phone number ID y un token con permiso de mensajería.
2. Publicar el webhook por HTTPS.
3. Cargar la misma cadena en "verify token" y en `WHATSAPP_VERIFY_TOKEN`.
4. Suscribir el campo `messages`.
5. Copiar el App Secret a `WHATSAPP_APP_SECRET`.

El token temporal del panel vence pronto. Para dejar el servicio andando, el token tiene que ser de un system user de larga duración.

## Qué no loguear

El proceso no escribe el texto del mensaje. Si más adelante se agrega un logger, el body y el token no deberían ir al log: el token sale en el header `Authorization` y el body es contenido de un chat.
