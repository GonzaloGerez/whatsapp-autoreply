# Funciones

Cada función existe para separar una decisión. Esta página dice por qué está, no cómo recorre el código. El flujo de los endpoints está en [arquitectura.md](arquitectura.md).

## `src/server.ts`

No declara funciones. Es el proceso del contenedor: lee `.env`, corta el arranque si faltan token, número o verify token, y llama a `listen`. Existe para que `npm start` y Docker tengan una entrada sola, sin mezclar eso con la librería.

## `src/index.ts`

Tampoco declara funciones. Reexporta lo que otro proyecto puede importar. Existe para que quien embebe el bot no dependa de la ruta interna de cada archivo.

## `src/env.ts`

| Función | Por qué existe |
| --- | --- |
| `loadEnvFile` | El contenedor y la PC de prueba cargan el mismo `.env`. Existe para no sumar una dependencia, y para no pisar una variable que ya vino del entorno: en Docker los valores entran por `env_file` y tienen que ganar. |

## `src/config.ts`

| Función | Por qué existe |
| --- | --- |
| `loadConfig` | Junta las variables sueltas en un solo objeto. Existe para que el servidor y el ejemplo no repitan los nombres `WHATSAPP_*`. |
| `missingConfigKeys` | El proceso no puede verificar el webhook ni enviar sin token, número y verify token. Existe para frenar el arranque con un mensaje claro, en vez de fallar en el primer POST de Meta. |
| `normalizePort` | Un `PORT` vacío o inválido no debe tirar el proceso. Existe para caer en `3000` cuando el valor no es un puerto usable. |
| `normalizePath` | Meta y el health check comparan rutas. Existe para que `/webhook`, `webhook` y `/webhook/` sean la misma ruta y no se responda 404 por una barra. |

## `src/signature.ts`

| Función | Por qué existe |
| --- | --- |
| `isValidSignature` | Cualquiera que conozca la URL podría disparar una respuesta. Existe para aceptar el POST solo si Meta lo firmó con el app secret. |
| `sign` | La firma que manda Meta es `sha256=` más el HMAC del body crudo. Existe para construir ese valor en un solo lugar y compararlo sin reinterpretar el JSON. |

## `src/parse.ts`

| Función | Por qué existe |
| --- | --- |
| `extractMessages` | El webhook trae un sobre con estados, contactos y mensajes. Existe para que el handler vea solo mensajes de usuario, con nombre y texto ya ubicados, y no el sobre de Meta. |
| `isRecord` | El body llega como `unknown`. Existe para no leer campos de un valor que no es un objeto. |

## `src/client.ts`

| Función | Por qué existe |
| --- | --- |
| `WhatsAppApiError` | Graph responde errores con status y `error.message`. Existe para que quien llama distinga un rechazo de Meta de un fallo nuestro, y para que el webhook pueda devolver 500 y dejar que Meta reintente. |
| `createClient` | El bot necesita un único lugar que conozca la URL, el token y el timeout. Existe para que el resto no arme el POST a Graph a mano. |
| `send` | Texto y, más adelante, plantillas pegan al mismo endpoint con bodies distintos. Existe como la salida genérica; `sendText` es el caso de prueba de hoy. |
| `sendText` | La contestación de esta PoC es texto libre. Existe para armar ese body y no obligar al handler a conocer `messaging_product` ni `preview_url`. |
| `formatRecipient` | Meta manda el número sin `+`, y al responder sin el signo le agrega el país del número de la cuenta. Existe para anteponer `+` solo cuando el valor es dígitos. |
| `graphErrorMessage` | El JSON de error de Graph no siempre tiene la forma esperada. Existe para sacar `error.message` cuando está, y no romper si el body vino vacío o distinto. |
| `isRecord` | Misma razón que en el parser: el JSON de respuesta es `unknown` hasta que se comprueba. |

## `src/bot.ts`

| Función | Por qué existe |
| --- | --- |
| `createWhatsAppBot` | Es la pieza que se embebe o se levanta sola. Existe para atar config, cliente, handler y el dedupe en un objeto, sin elegir todavía si el HTTP lo abre este proceso o una app de afuera. |
| `verify` | Meta, al dar de alta el webhook, manda un GET y espera el challenge de vuelta. Existe para contestar ese alta sin tocar Graph. |
| `receive` | Un POST puede traer varios mensajes, un duplicado o una firma mala. Existe para decidir si se contesta, y para no marcar el id como visto si el envío a Meta falló. |
| `handleNodeRequest` | Express u otro servidor ya tienen su `req` y `res`. Existe para enganchar el webhook en esa app sin crear otro servidor. |
| `listen` | El contenedor de prueba necesita un proceso que escuche solo. Existe para abrir el HTTP, separar `/health` del webhook y dejar el resto en 404. |
| `defaultReply` | Eco de la librería. Existe para devolver el mismo texto cuando nadie pasa un `onMessage`, y para no contestar lo que no es texto. El proceso de prueba no lo usa: pasa `recipeOnMessage`. |
| `deliver` | El handler puede devolver un string, `{ text }` o una lista. Existe para traducir eso a uno o más `sendText`, y para no enviar nada si el handler no contestó. |
| `alreadySeen` | Meta reintenta el webhook si no respondemos a tiempo. Existe para no volver a contestar un `wamid` que este proceso ya cerró. |
| `markSeen` | El dedupe tiene que recordar el id después de un envío bueno, y no crecer sin límite. Existe para guardar el id y olvidar el más viejo al pasar de 1000. |
| `readBody` | La firma se calcula sobre los bytes originales, no sobre el objeto parseado. Existe para juntar el body crudo y cortar un POST enorme antes de procesarlo. |
| `sendPlain` | Las respuestas a Meta son texto corto y un status. Existe para no repetir ese `writeHead` en cada rama. |
| `first` | Node a veces entrega un header como string y a veces como lista. Existe para quedarse con un solo valor antes de comparar el token o la firma. |

## `examples/custom-reply.ts`

El `onMessage` de ese archivo no es parte de la librería. Existe para probar un saludo con el nombre del perfil. `npm start` usa el menú de recetas.

## `src/recipes.ts` y `src/menu.ts`

| Función | Por qué existe |
| --- | --- |
| `recipes` | Inventario de la prueba. Existe para que las preparaciones vivan en el proyecto y el número del menú sea su orden. |
| `replyForRecipe` | Cada mensaje se lee solo. Existe para devolver una receta si el texto es su número o su nombre, y el menú completo en cualquier otro caso. |
| `formatMenu` | La lista tiene que decir cómo pedir una receta. Existe para armar ese texto en un solo lugar. |
| `recipeOnMessage` | El proceso de prueba necesita un handler. Existe para no contestar lo que no es texto y para enchufar `replyForRecipe` en `onMessage`. |
