import http from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createClient, formatRecipient } from './client.ts'
import { normalizePath } from './config.ts'
import { extractMessages } from './parse.ts'
import { isValidSignature } from './signature.ts'
import type {
  BotOptions,
  IncomingWhatsAppMessage,
  Reply,
  WebhookResult,
  WhatsAppBot,
  WhatsAppClient,
} from './types.ts'

const MAX_BODY_BYTES = 1_000_000
const MAX_SEEN = 1000

/** Ata config, cliente, handler y dedupe en un objeto, sin decidir si el HTTP lo abre este proceso o una app de afuera. */
export function createWhatsAppBot(options: BotOptions): WhatsAppBot {
  const {
    accessToken,
    phoneNumberId,
    verifyToken,
    appSecret = '',
    apiVersion,
    onMessage,
    fetchImpl,
    logger = console,
  } = options

  if (!verifyToken) throw new Error('verifyToken is required')

  const client = createClient({ accessToken, phoneNumberId, apiVersion, fetchImpl })
  const handler = onMessage ?? defaultReply
  const seen = new Set<string>()

  if (!appSecret) {
    logger.warn?.(
      '[whatsapp-autoreply] WHATSAPP_APP_SECRET vacío: el webhook acepta POST sin validar la firma.',
    )
  }

  /** Contesta el GET de alta de Meta devolviendo el challenge, sin llamar a Graph. */
  function verify(query: Record<string, string | string[] | undefined>): WebhookResult {
    const mode = first(query['hub.mode'])
    const token = first(query['hub.verify_token'])
    const challenge = first(query['hub.challenge'])
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return { status: 200, body: String(challenge), contentType: 'text/plain' }
    }
    return { status: 403, body: 'Forbidden', contentType: 'text/plain' }
  }

  /** Decide si cada mensaje del POST se contesta, y no marca el id como visto si el envío a Meta falló. */
  async function receive({
    rawBody,
    signature,
    payload,
  }: {
    rawBody: Buffer | string
    signature?: string
    payload: unknown
  }): Promise<WebhookResult> {
    if (appSecret && !isValidSignature(appSecret, rawBody, signature)) {
      return { status: 401, body: 'Invalid signature' }
    }

    const messages = extractMessages(payload)
    for (const message of messages) {
      if (alreadySeen(seen, message.id)) continue
      try {
        const reply = await handler(message, { client, phoneNumberId })
        await deliver(client, message.from, reply)
        markSeen(seen, message.id)
      } catch (error) {
        logger.error?.(
          '[whatsapp-autoreply] no se pudo responder',
          message.id || message.from,
          error instanceof Error ? error.message : error,
        )
        return { status: 500, body: 'Error' }
      }
    }

    return { status: 200, body: 'OK' }
  }

  /** Engancha el webhook en un `req`/`res` que ya existe, para embeberlo sin abrir otro servidor. */
  async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost')
        const result = verify(Object.fromEntries(url.searchParams))
        sendPlain(res, result.status, result.body)
        return
      }

      if (req.method !== 'POST') {
        sendPlain(res, 405, 'Method Not Allowed')
        return
      }

      const rawBody = await readBody(req)
      let payload: unknown
      try {
        payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}
      } catch {
        sendPlain(res, 400, 'Invalid JSON')
        return
      }

      const result = await receive({
        rawBody,
        signature: first(req.headers['x-hub-signature-256']),
        payload,
      })
      sendPlain(res, result.status, result.body)
    } catch (error) {
      logger.error?.(
        '[whatsapp-autoreply] fallo el webhook',
        error instanceof Error ? error.message : error,
      )
      if (!res.headersSent) sendPlain(res, 500, 'Error')
    }
  }

  /** Abre el HTTP del contenedor: `/health` para saber si vive, el webhook aparte, y 404 en el resto. */
  function listen({
    port = 3000,
    host = '0.0.0.0',
    path = '/webhook',
  }: { port?: number; host?: string; path?: string } = {}) {
    const webhookPath = normalizePath(path)
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost')
      const pathname = normalizePath(url.pathname)

      if (req.method === 'GET' && pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: true }))
        return
      }

      if (pathname !== webhookPath) {
        sendPlain(res, 404, 'Not Found')
        return
      }

      void handleNodeRequest(req, res)
    })

    return new Promise<http.Server>((resolve, reject) => {
      const onError = (error: Error) => reject(error)
      server.once('error', onError)
      server.listen(port, host, () => {
        server.off('error', onError)
        resolve(server)
      })
    })
  }

  return { verify, receive, handleNodeRequest, listen, client }
}

/** Contestación simple de la PoC: devuelve el mismo texto, y no contesta lo que no es texto. */
async function defaultReply(message: IncomingWhatsAppMessage): Promise<Reply | undefined> {
  if (message.type !== 'text' || !message.text) return undefined
  return { text: message.text }
}

/** Traduce lo que devolvió el handler a uno o más envíos, y no llama a Meta si no hubo respuesta. */
async function deliver(
  client: WhatsAppClient,
  to: string,
  reply: Reply | Reply[] | void,
): Promise<void> {
  if (reply == null) return
  const replies = Array.isArray(reply) ? reply : [reply]
  for (const item of replies) {
    const text = typeof item === 'string' ? item : item?.text
    if (!text) continue
    await client.sendText(formatRecipient(to), text)
  }
}

/** Meta reintenta el webhook. Evita contestar de nuevo un `wamid` que este proceso ya cerró. */
function alreadySeen(seen: Set<string>, id: string | undefined): boolean {
  return id !== undefined && seen.has(id)
}

/** Recuerda el id después de un envío bueno y olvida el más viejo al pasar de 1000, para que el dedupe no crezca sin límite. */
function markSeen(seen: Set<string>, id: string | undefined): void {
  if (!id) return
  seen.add(id)
  if (seen.size <= MAX_SEEN) return
  const oldest = seen.values().next().value
  if (oldest) seen.delete(oldest)
}

/** Junta los bytes crudos del POST: la firma se calcula sobre ellos, no sobre el JSON ya parseado. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buf.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Las respuestas a Meta son un status y un texto corto. Centraliza ese `writeHead`. */
function sendPlain(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

/** Node entrega algunos headers como string y otros como lista. Se queda con un solo valor para comparar. */
function first(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === 'string') return value
  return value?.[0]
}
