export function extractMessages(payload) {
  const messages = []
  const entries = Array.isArray(payload?.entry) ? payload.entry : []

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : []
    for (const change of changes) {
      const value = change?.value ?? {}
      const phoneNumberId = value.metadata?.phone_number_id
      const names = new Map()
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
