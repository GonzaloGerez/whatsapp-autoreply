import { createHmac } from 'node:crypto'
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { createWhatsAppBot } from '../src/bot.ts'
import { formatRecipient } from '../src/client.ts'
import type { BotOptions } from '../src/types.ts'

const silent = { warn() {}, error() {}, info() {} }

interface RecordedCall {
  url: string
  authorization: string | undefined
  body: {
    messaging_product: string
    recipient_type: string
    to: string
    type: string
    text: { preview_url: boolean; body: string }
  }
}

function textWebhook(body: string, id = 'wamid.1') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: '123' },
              contacts: [{ wa_id: '5491112345678', profile: { name: 'Ada' } }],
              messages: [
                {
                  from: '5491112345678',
                  id,
                  timestamp: '1710000000',
                  type: 'text',
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  }
}

function createTestBot(overrides: Partial<BotOptions> = {}) {
  const calls: RecordedCall[] = []
  const fetchImpl: typeof fetch =
    overrides.fetchImpl ??
    (async (url, init) => {
      const headers = init?.headers
      const authorization =
        headers && !Array.isArray(headers) && !(headers instanceof Headers)
          ? headerValue(headers.Authorization ?? headers.authorization)
          : undefined
      calls.push({
        url: String(url),
        authorization,
        body: JSON.parse(String(init?.body ?? '{}')) as RecordedCall['body'],
      })
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.out' }] }), { status: 200 })
    })

  const bot = createWhatsAppBot({
    accessToken: 'token',
    phoneNumberId: '123',
    verifyToken: 'verify-me',
    appSecret: 'secret',
    logger: silent,
    ...overrides,
    fetchImpl,
  })

  return { bot, calls }
}

test('verifica el webhook cuando el token coincide', () => {
  const { bot } = createTestBot()
  const result = bot.verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'verify-me',
    'hub.challenge': '12345',
  })
  assert.equal(result.status, 200)
  assert.equal(result.body, '12345')
})

test('rechaza la verificación con un token distinto', () => {
  const { bot } = createTestBot()
  const result = bot.verify({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'otro',
    'hub.challenge': '12345',
  })
  assert.equal(result.status, 403)
})

test('responde el texto recibido y manda el número con prefijo +', async () => {
  const { bot, calls } = createTestBot()
  const payload = textWebhook('hola')
  const result = await bot.receive({
    rawBody: JSON.stringify(payload),
    signature: signature('secret', JSON.stringify(payload)),
    payload,
  })

  assert.equal(result.status, 200)
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, 'https://graph.facebook.com/v27.0/123/messages')
  assert.equal(calls[0]?.authorization, 'Bearer token')
  assert.deepEqual(calls[0]?.body, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '+5491112345678',
    type: 'text',
    text: { preview_url: false, body: 'hola' },
  })
})

test('usa el handler propio y acepta un string como respuesta', async () => {
  const { bot, calls } = createTestBot({
    async onMessage(message) {
      return `Hola ${message.name}: ${message.text}`
    },
  })
  const payload = textWebhook('ping')
  await bot.receive({
    rawBody: JSON.stringify(payload),
    signature: signature('secret', JSON.stringify(payload)),
    payload,
  })
  assert.equal(calls[0]?.body.text.body, 'Hola Ada: ping')
})

test('no responde dos veces el mismo mensaje', async () => {
  const { bot, calls } = createTestBot()
  const payload = textWebhook('hola', 'wamid.dup')
  const input = {
    rawBody: JSON.stringify(payload),
    signature: signature('secret', JSON.stringify(payload)),
    payload,
  }
  await bot.receive(input)
  await bot.receive(input)
  assert.equal(calls.length, 1)
})

test('no llama a la API si el mensaje no es texto', async () => {
  const { bot, calls } = createTestBot()
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ from: '5491112345678', id: 'wamid.img', type: 'image', image: { id: '1' } }],
            },
          },
        ],
      },
    ],
  }
  const result = await bot.receive({
    rawBody: JSON.stringify(payload),
    signature: signature('secret', JSON.stringify(payload)),
    payload,
  })
  assert.equal(result.status, 200)
  assert.equal(calls.length, 0)
})

test('ignora avisos de estado que no traen mensajes', async () => {
  const { bot, calls } = createTestBot()
  const payload = { entry: [{ changes: [{ value: { statuses: [{ id: '1', status: 'read' }] } }] }] }
  const result = await bot.receive({
    rawBody: JSON.stringify(payload),
    signature: signature('secret', JSON.stringify(payload)),
    payload,
  })
  assert.equal(result.status, 200)
  assert.equal(calls.length, 0)
})

test('rechaza una firma inválida y no reintenta un envío fallido como éxito', async () => {
  let attempts = 0
  const { bot } = createTestBot({
    async fetchImpl() {
      attempts += 1
      if (attempts === 1) {
        return new Response(JSON.stringify({ error: { message: 'temporal' } }), { status: 500 })
      }
      return new Response(JSON.stringify({ messages: [{ id: 'ok' }] }), { status: 200 })
    },
  })
  const payload = textWebhook('hola', 'wamid.retry')
  const rawBody = JSON.stringify(payload)

  const rejected = await bot.receive({ rawBody, signature: 'sha256=no', payload })
  assert.equal(rejected.status, 401)
  assert.equal(attempts, 0)

  const failed = await bot.receive({ rawBody, signature: signature('secret', rawBody), payload })
  assert.equal(failed.status, 500)

  const retried = await bot.receive({ rawBody, signature: signature('secret', rawBody), payload })
  assert.equal(retried.status, 200)
  assert.equal(attempts, 2)
})

test('el servidor verifica el challenge y expone /health', async () => {
  const { bot } = createTestBot()
  const server = await bot.listen({ port: 0, host: '127.0.0.1', path: '/webhook' })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected a TCP port')
  const { port } = address as AddressInfo
  try {
    const health = await fetch(`http://127.0.0.1:${port}/health`)
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const verified = await fetch(
      `http://127.0.0.1:${port}/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc`,
    )
    assert.equal(verified.status, 200)
    assert.equal(await verified.text(), 'abc')

    const missing = await fetch(`http://127.0.0.1:${port}/otra`)
    assert.equal(missing.status, 404)
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test('agrega + solo a números en dígitos', () => {
  assert.equal(formatRecipient('5491112345678'), '+5491112345678')
  assert.equal(formatRecipient('+5491112345678'), '+5491112345678')
})

function signature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

function headerValue(value: string | undefined): string | undefined {
  return value
}
