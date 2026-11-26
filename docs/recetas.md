# Recetas

El proceso de prueba (`npm start` y el contenedor) contesta con el inventario de [src/recipes.ts](../src/recipes.ts). Cada mensaje se lee solo. No recuerda si el menú ya se mostró.

Si el texto es el número de la lista o el nombre de una receta, la respuesta es esa preparación. Cualquier otro texto recibe la lista completa. Una imagen u otro tipo no se contesta.

Ejemplo:

- `hola` devuelve las tres recetas y la frase "Respondé con el número o el nombre."
- `2` o `milanesas` devuelve la preparación de milanesas.

El orden del archivo es el número del menú. Para cambiar el inventario se edita ese archivo. El eco de `defaultReply` sigue en la librería y se usa solo cuando nadie pasa un `onMessage`.
