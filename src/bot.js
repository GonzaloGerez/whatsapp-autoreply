import http from 'node:http'
import { createClient, formatRecipient } from './client.js'
import { extractMessages } from './parse.js'
import { isValidSignature } from './signature.js'
import { normalizePath } from './config.js'

const MAX_BODY_BYTES = 1_000_000
const MAX_SEEN = 1000

export function createWhatsAppBot(options) {
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
  const seen = new Set()

  if (!appSecret) {
    logger.warn?.(
      '[whatsapp-autoreply] WHATSAPP_APP_SECRET vacío: el webhook acepta POST sin validar la firma.',
    )
  }

  function verify(query) {
    const mode = first(query['hub.mode'])
    const token = first(query['hub.verify_token'])
    const challenge = first(query['hub.challenge'])
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return { status: 200, body: String(challenge), contentType: 'text/plain' }
    }
    return { status: 403, body: 'Forbidden', contentType: 'text/plain' }
  }

  async function receive({ rawBody, signature, payload }) {
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

  async function handleNodeRequest(req, res) {
    try {
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://localhost')
        const result = verify(Object.fromEntries(url.searchParams))
        sendText(res, result.status, result.body)
        return
      }

      if (req.method !== 'POST') {
        sendText(res, 405, 'Method Not Allowed')
        return
      }

      const rawBody = await readBody(req)
      let payload
      try {
        payload = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}
      } catch {
        sendText(res, 400, 'Invalid JSON')
        return
      }

      const result = await receive({
        rawBody,
        signature: first(req.headers['x-hub-signature-256']),
        payload,
      })
      sendText(res, result.status, result.body)
    } catch (error) {
      logger.error?.(
        '[whatsapp-autoreply] fallo el webhook',
        error instanceof Error ? error.message : error,
      )
      if (!res.headersSent) sendText(res, 500, 'Error')
    }
  }

  function listen({ port = 3000, host = '0.0.0.0', path = '/webhook' } = {}) {
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
        sendText(res, 404, 'Not Found')
        return
      }

      handleNodeRequest(req, res)
    })

    return new Promise((resolve, reject) => {
      const onError = (error) => reject(error)
      server.once('error', onError)
      server.listen(port, host, () => {
        server.off('error', onError)
        resolve(server)
      })
    })
  }

  return { verify, receive, handleNodeRequest, listen, client }
}

async function defaultReply(message) {
  if (message.type !== 'text' || !message.text) return undefined
  return { text: message.text }
}

async function deliver(client, to, reply) {
  if (reply == null) return
  const replies = Array.isArray(reply) ? reply : [reply]
  for (const item of replies) {
    const text = typeof item === 'string' ? item : item?.text
    if (!text) continue
    await client.sendText(formatRecipient(to), text)
  }
}

function alreadySeen(seen, id) {
  return Boolean(id) && seen.has(id)
}

function markSeen(seen, id) {
  if (!id) return
  seen.add(id)
  if (seen.size <= MAX_SEEN) return
  const oldest = seen.values().next().value
  seen.delete(oldest)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function sendText(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

function first(value) {
  return Array.isArray(value) ? value[0] : value
}
