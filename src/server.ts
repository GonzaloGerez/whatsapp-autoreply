import { createWhatsAppBot } from './bot.ts'
import { loadConfig, missingConfigKeys } from './config.ts'
import { loadEnvFile } from './env.ts'
import { recipeOnMessage } from './menu.ts'

loadEnvFile()

const config = loadConfig()
const missing = missingConfigKeys(config)
if (missing.length > 0) {
  console.error(`[whatsapp-autoreply] faltan variables: ${missing.join(', ')}`)
  console.error('[whatsapp-autoreply] copiá .env.example a .env y completá los valores.')
  process.exit(1)
}

const bot = createWhatsAppBot({ ...config, onMessage: recipeOnMessage })
const server = await bot.listen({ port: config.port, path: config.webhookPath })
const address = server.address()
const port = typeof address === 'object' && address ? address.port : config.port
console.log(`[whatsapp-autoreply] webhook en http://localhost:${port}${config.webhookPath}`)
