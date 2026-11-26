import type { IncomingWhatsAppMessage } from './types.ts'

interface WebhookContact {
  wa_id?: string
  profile?: { name?: string }
}

interface WebhookMessage {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: { body?: string }
}

interface WebhookValue {
  metadata?: { phone_number_id?: string }
  contacts?: WebhookContact[]
  messages?: WebhookMessage[]
}

interface WebhookPayload {
  entry?: Array<{
    changes?: Array<{ value?: WebhookValue }>
  }>
}

/** Saca los mensajes de usuario del sobre del webhook para que el handler no recorra `entry` ni los estados de entrega. */
export function extractMessages(payload: unknown): IncomingWhatsAppMessage[] {
  const body = isRecord(payload) ? (payload as WebhookPayload) : {}
  const messages: IncomingWhatsAppMessage[] = []
  const entries = Array.isArray(body.entry) ? body.entry : []

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const value = change?.value ?? {}
      const phoneNumberId = value.metadata?.phone_number_id
      const names = new Map<string, string | undefined>()
      for (const contact of value.contacts ?? []) {
        if (contact?.wa_id) names.set(contact.wa_id, contact.profile?.name)
      }

      for (const message of value.messages ?? []) {
        if (!message?.from) continue
        messages.push({
          id: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: message.type || 'unknown',
          text: message.type === 'text' ? message.text?.body ?? '' : undefined,
          name: names.get(message.from),
          phoneNumberId,
          raw: message,
        })
      }
    }
  }

  return messages
}

/** El body llega como `unknown`. Comprueba que sea un objeto antes de leerle campos. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
