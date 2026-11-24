import { createHmac, timingSafeEqual } from 'node:crypto'

export function isValidSignature(appSecret, rawBody, header) {
  if (!appSecret || !header) return false

  const expected = Buffer.from(sign(appSecret, rawBody))
  const actual = Buffer.from(String(header))
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

function sign(appSecret, rawBody) {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}
