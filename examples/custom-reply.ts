import { createWhatsAppBot, loadConfig, loadEnvFile } from '../src/index.ts'

loadEnvFile()

const config = loadConfig()
const bot = createWhatsAppBot({
  ...config,
  /** Saludo de prueba con el nombre del perfil. Existe para ver otra respuesta sin cambiar el eco de `npm start`. */
  async onMessage(message) {
    if (message.type !== 'text' || !message.text) return undefined
    const name = message.name ? ` ${message.name}` : ''
    return { text: `Hola${name}. Recibimos: ${message.text}` }
  },
})

const server = await bot.listen({ port: config.port, path: config.webhookPath })
const address = server.address()
const port = typeof address === 'object' && address ? address.port : config.port
console.log(`[whatsapp-autoreply] ejemplo en http://localhost:${port}${config.webhookPath}`)
