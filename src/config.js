const DEFAULT_API_VERSION = 'v27.0'

export function loadConfig(env = process.env) {
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

export function missingConfigKeys(config) {
  const missing = []
  if (!config.accessToken) missing.push('WHATSAPP_ACCESS_TOKEN')
  if (!config.phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID')
  if (!config.verifyToken) missing.push('WHATSAPP_VERIFY_TOKEN')
  return missing
}

function normalizePort(value) {
  const port = Number(value || 3000)
  return Number.isInteger(port) && port > 0 ? port : 3000
}

export function normalizePath(value) {
  const raw = String(value || '/webhook')
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  if (withSlash === '/') return '/'
  return withSlash.replace(/\/+$/, '')
}
