import { recipes } from './recipes.ts'
import type { IncomingWhatsAppMessage, Reply } from './types.ts'

/** Elige una receta por número o nombre. Si no coincide, devuelve el menú completo. */
export function replyForRecipe(text: string): string {
  const query = normalize(text)
  const byNumber = recipeAt(query)
  if (byNumber) return byNumber.body
  const byName = recipes.find((recipe) => normalize(recipe.name) === query)
  if (byName) return byName.body
  return formatMenu()
}

/** Arma la lista numerada. El número es la posición del inventario, que no cambia entre mensajes. */
export function formatMenu(): string {
  const lines = recipes.map((recipe, index) => `${index + 1}. ${recipe.name}`)
  return ['Estas son las recetas:', ...lines, '', 'Respondé con el número o el nombre.'].join('\n')
}

/** Handler del proceso de prueba. Un mensaje que no es texto no se contesta. */
export function recipeOnMessage(message: IncomingWhatsAppMessage): Reply | undefined {
  if (message.type !== 'text' || !message.text) return undefined
  return { text: replyForRecipe(message.text) }
}

function recipeAt(query: string) {
  if (!/^\d+$/.test(query)) return undefined
  const index = Number(query) - 1
  if (index < 0 || index >= recipes.length) return undefined
  return recipes[index]
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}
