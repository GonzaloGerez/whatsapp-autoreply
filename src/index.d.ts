import type { IncomingMessage, Server, ServerResponse } from 'node:http'

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
  verifyToken: string
  appSecret: string
  apiVersion: string
  port: number
  webhookPath: string
}

export interface IncomingWhatsAppMessage {
  id?: string
  from: string
  timestamp?: string
  type: string
  text?: string
  name?: string
  phoneNumberId?: string
  raw: unknown
}

export interface TextReply {
  text: string
}

export type Reply = TextReply | string

export interface WhatsAppClient {
  sendText(to: string, body: string): Promise<unknown>
  send(payload: Record<string, unknown>): Promise<unknown>
}

export interface BotContext {
  client: WhatsAppClient
  phoneNumberId: string
}

export type MessageHandler = (
  message: IncomingWhatsAppMessage,
  context: BotContext,
) => Reply | Reply[] | void | Promise<Reply | Reply[] | void>

export interface BotOptions {
  accessToken: string
  phoneNumberId: string
  verifyToken: string
  appSecret?: string
  apiVersion?: string
  onMessage?: MessageHandler
  fetchImpl?: typeof fetch
  logger?: {
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
  }
}

export interface WebhookResult {
  status: number
  body: string
  contentType?: string
}

export interface WhatsAppBot {
  verify(query: Record<string, string | undefined>): WebhookResult
  receive(input: {
    rawBody: Buffer | string
    signature?: string
    payload: unknown
  }): Promise<WebhookResult>
  handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void>
  listen(options?: { port?: number; host?: string; path?: string }): Promise<Server>
  client: WhatsAppClient
}

export function createWhatsAppBot(options: BotOptions): WhatsAppBot
export function createClient(options: {
  accessToken: string
  phoneNumberId: string
  apiVersion?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}): WhatsAppClient
export function loadConfig(env?: NodeJS.ProcessEnv): WhatsAppConfig
export function loadEnvFile(path?: string): void
