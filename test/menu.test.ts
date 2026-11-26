import assert from 'node:assert/strict'
import test from 'node:test'
import { createWhatsAppBot } from '../src/bot.ts'
import { formatMenu, recipeOnMessage, replyForRecipe } from '../src/menu.ts'
import { recipes } from '../src/recipes.ts'

const silent = { warn() {}, error() {}, info() {} }

test('un número devuelve esa receta', () => {
  assert.equal(replyForRecipe('2'), recipes[1]?.body)
})

test('un nombre ignora mayúsculas y espacios', () => {
  assert.equal(replyForRecipe('  milanesas '), recipes[1]?.body)
  assert.equal(replyForRecipe('Tarta de manzana'), recipes[0]?.body)
})

test('un número fuera de la lista devuelve el menú', () => {
  assert.equal(replyForRecipe('9'), formatMenu())
})

test('un texto que no elige receta devuelve el menú completo', () => {
  const menu = replyForRecipe('hola')
  assert.equal(menu, formatMenu())
  assert.match(menu, /1\. Tarta de manzana/)
  assert.match(menu, /2\. Milanesas/)
  assert.match(menu, /3\. Arroz con verduras/)
  assert.match(menu, /Respondé con el número o el nombre\./)
})

test('un mensaje que no es texto no llama a la API', async () => {
  let calls = 0
  const bot = createWhatsAppBot({
    accessToken: 'token',
    phoneNumberId: '123',
    verifyToken: 'verify-me',
    logger: silent,
    onMessage: recipeOnMessage,
    async fetchImpl() {
      calls += 1
      return new Response('{}', { status: 200 })
    },
  })
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ from: '5491112345678', id: 'wamid.img', type: 'image', image: { id: '1' } }],
            },
          },
        ],
      },
    ],
  }

  const result = await bot.receive({ rawBody: JSON.stringify(payload), payload })
  assert.equal(result.status, 200)
  assert.equal(calls, 0)
})
