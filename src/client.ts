const DEFAULT_TIMEOUT_MS = 15_000

/** Separa un rechazo de Graph de un fallo nuestro, y conserva el status para que el webhook pueda responder 500 y Meta reintente. */
export class WhatsAppApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(status: number, detail: string, details: unknown) {
    super(`WhatsApp API ${status}: ${detail}`)
    this.name = 'WhatsAppApiError'
    this.status = status
    this.details = details
  }
}

/** Concentra URL, token y timeout del POST a Graph. El resto del bot no arma ese request. */
export function createClient({
  accessToken,
  phoneNumberId,
  apiVersion = 'v27.0',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  accessToken: string
  phoneNumberId: string
  apiVersion?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}) {
  if (!accessToken) throw new Error('accessToken is required')
  if (!phoneNumberId) throw new Error('phoneNumberId is required')

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  /** Salida genérica al mismo endpoint. Texto y, más adelante, plantillas cambian el body, no la URL. */
  async function send(payload: Record<string, unknown>): Promise<unknown> {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        ...payload,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    const data: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = graphErrorMessage(data) || response.statusText || 'request failed'
      throw new WhatsAppApiError(response.status, detail, data)
    }
    return data
  }

  return {
    /** Arma el body de texto libre para que el handler no conozca el formato de Cloud API. */
    sendText(to: string, body: string) {
      return send({
        to: formatRecipient(to),
        type: 'text',
        text: { preview_url: false, body },
      })
    },
    send,
  }
}

/** Antepone `+` a un número de solo dígitos. Sin ese signo, Meta le agrega el país del número de la cuenta. */
export function formatRecipient(value: string): string {
  const recipient = String(value || '').trim()
  if (!recipient || recipient.startsWith('+') || !/^\d+$/.test(recipient)) return recipient
  return `+${recipient}`
}

/** Lee `error.message` de Graph cuando el JSON lo trae, y no falla si el body vino vacío o distinto. */
function graphErrorMessage(data: unknown): string | undefined {
  if (!isRecord(data) || !isRecord(data.error)) return undefined
  return typeof data.error.message === 'string' ? data.error.message : undefined
}

/** La respuesta de Graph es `unknown` hasta comprobar que es un objeto. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
