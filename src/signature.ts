import { createHmac, timingSafeEqual } from 'node:crypto'

/** Acepta el POST solo si la firma de Meta cierra con el app secret. Sin esto, conocer la URL alcanza para disparar una respuesta. */
export function isValidSignature(
  appSecret: string,
  rawBody: Buffer | string,
  header: string | undefined,
): boolean {
  if (!appSecret || !header) return false

  const expected = Buffer.from(sign(appSecret, rawBody))
  const actual = Buffer.from(header)
  if (expected.length !== actual.length) return false
  return timingSafeEqual(expected, actual)
}

/** Arma el `sha256=` que Meta manda en `X-Hub-Signature-256`, sobre los bytes crudos. */
function sign(appSecret: string, rawBody: Buffer | string): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
}
