const DEFAULT_TIMEOUT_MS = 15_000

export function createClient({
  accessToken,
  phoneNumberId,
  apiVersion = 'v27.0',
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!accessToken) throw new Error('accessToken is required')
  if (!phoneNumberId) throw new Error('phoneNumberId is required')

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`

  async function send(payload) {
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

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const detail = data?.error?.message || response.statusText || 'request failed'
      const error = new Error(`WhatsApp API ${response.status}: ${detail}`)
      error.status = response.status
      error.details = data
      throw error
    }
    return data
  }

  return {
    sendText(to, body) {
      return send({
        to: formatRecipient(to),
        type: 'text',
        text: { preview_url: false, body },
      })
    },
    send,
  }
}

export function formatRecipient(value) {
  const recipient = String(value || '').trim()
  if (!recipient || recipient.startsWith('+') || !/^\d+$/.test(recipient)) return recipient
  return `+${recipient}`
}
