import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Carga `.env` sin pisar variables ya definidas, para que Docker pueda inyectarlas y no haga falta otra dependencia. */
export function loadEnvFile(path = resolve(process.cwd(), '.env')): void {
  if (!existsSync(path)) return

  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    if (quoted) value = value.slice(1, -1)

    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
