export interface Recipe {
  id: string
  name: string
  body: string
}

/** Inventario fijo de la prueba. El orden define el número del menú. */
export const recipes: readonly Recipe[] = [
  {
    id: 'tarta-de-manzana',
    name: 'Tarta de manzana',
    body: [
      'Tarta de manzana',
      '',
      'Ingredientes:',
      '- 2 manzanas',
      '- 1 masa',
      '- 2 cucharadas de azúcar',
      '',
      'Pasos:',
      '1. Cortar las manzanas.',
      '2. Cubrir la masa y espolvorear el azúcar.',
      '3. Hornear 30 minutos.',
    ].join('\n'),
  },
  {
    id: 'milanesas',
    name: 'Milanesas',
    body: [
      'Milanesas',
      '',
      'Ingredientes:',
      '- 2 filetes de carne',
      '- 1 huevo',
      '- pan rallado',
      '',
      'Pasos:',
      '1. Pasar la carne por huevo y pan rallado.',
      '2. Freír hasta que doren.',
    ].join('\n'),
  },
  {
    id: 'arroz-con-verduras',
    name: 'Arroz con verduras',
    body: [
      'Arroz con verduras',
      '',
      'Ingredientes:',
      '- 1 taza de arroz',
      '- 1 zanahoria',
      '- 1 morrón',
      '',
      'Pasos:',
      '1. Sofreír la zanahoria y el morrón.',
      '2. Agregar el arroz y dos tazas de agua.',
      '3. Cocinar hasta que se absorba el agua.',
    ].join('\n'),
  },
]
