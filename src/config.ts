import type { WhatsAppConfig } from './types.ts'

const DEFAULT_API_VERSION = 'v27.0'

/** Junta las variables `WHATSAPP_*` en un objeto para que el arranque no repita esos nombres. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): WhatsAppConfig {
  return {
    accessToken: env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: env.WHATSAPP_APP_SECRET || '',
    apiVersion: env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
    port: normalizePort(env.PORT),
    webhookPath: normalizePath(env.WEBHOOK_PATH || '/webhook'),
  }
}

/** Lista token, número y verify token ausentes para frenar el arranque antes del primer POST de Meta. */
export function missingConfigKeys(config: WhatsAppConfig): string[] {
  const missing: string[] = []
  if (!config.accessToken) missing.push('WHATSAPP_ACCESS_TOKEN')
  if (!config.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID')
  if (!config.verifyToken) missing.push('WHATSAPP_VERIFY_TOKEN')
  return missing
}

/** Un `PORT` vacío o inválido cae en 3000 para que el proceso igual escuche. */
function normalizePort(value: string | undefined): number {
  const port = Number(value || 3000)
  return Number.isInteger(port) && port > 0 ? port : 3000
}

/** Unifica `/webhook`, `webhook` y `/webhook/` para que la comparación de rutas no responda 404 de más. */
export function normalizePath(value: string): string {
  const raw = String(value || '/webhook')
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '')
}
