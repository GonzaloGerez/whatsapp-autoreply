# Plantillas

Diseño, no implementación. El bot de prueba no envía plantillas: contesta con texto libre cuando llega un mensaje, que es lo que abre la ventana de 24 horas.

Una plantilla hace falta el día que el proceso tenga que escribir primero, o escribirle a alguien que no mandó un mensaje en las últimas 24 horas. Este documento deja cómo se engancharía sin cambiar el endpoint que ya usamos.

## Qué problema cubre

Meta distingue dos envíos, y los dos pegan al mismo `POST /{version}/{PHONE_NUMBER_ID}/messages`:

| Situación | Tipo | Hace falta aprobación de Meta |
| --- | --- | --- |
| El usuario escribió hace menos de 24 horas | `type: text` | No |
| Hay que iniciar o retomar la conversación | `type: template` | Sí, la plantilla tiene que estar aprobada |

Hoy solo existe el primer caso. `onMessage` devuelve texto y `sendText` arma el body. Una plantilla no reemplaza esa respuesta. Se suma como otro camino, para un disparo que todavía no tenemos (un recordatorio, una prueba manual, otro sistema).

## Dónde vive cada cosa

Meta es la fuente de verdad de lo que se puede enviar. El nombre, el idioma y el texto aprobado están en el administrador de WhatsApp. Este repo solo guardaría un catálogo con el nombre ya aprobado y el orden de los parámetros. No crearíamos plantillas por API en esta PoC.

El catálogo, cuando se implemente, sería un módulo del proyecto. Algo de este estilo:

```ts
export const templates = {
  aviso_prueba: {
    name: 'aviso_prueba',
    language: 'es_AR',
    body: 'Hola {{1}}. Este es un aviso de prueba.',
    parameters: ['nombre'],
  },
} as const
```

`name` y `language` tienen que coincidir exactamente con lo aprobado. `body` está acá para leer el diseño; Meta no lo recibe en el envío. `{{1}}` es el primer parámetro, en el orden de `parameters`.

## Cómo se enviaría

El cliente ya tiene `send(payload)`, que hace el mismo POST y agrega `messaging_product` y `recipient_type`. No haría falta otro endpoint. Un helper futuro `sendTemplate` armaría este body:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+5491112345678",
  "type": "template",
  "template": {
    "name": "aviso_prueba",
    "language": { "code": "es_AR" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Ada" }
        ]
      }
    ]
  }
}
```

`to` se normaliza igual que en el texto: si viene en dígitos, se le antepone `+`. Los `parameters` salen del catálogo, en orden, y cada valor es texto. Si falta un valor o sobra uno, no se llama a Meta.

El número de parámetros del catálogo tiene que ser el de la plantilla aprobada. Graph responde error si el nombre no existe, el idioma no coincide o la cantidad de variables no cierra. Ese error ya sube como `WhatsAppApiError`. Quien llame al helper decide si lo reintenta. El webhook de una respuesta normal no debería usar este camino: si una plantilla falla ahí, Meta reintenta el mensaje del usuario y podemos contestarle mal dos veces.

## Cuándo se elige una u otra

```text
llega un mensaje del usuario
  -> contestar con texto libre, como ahora

alguien pide un aviso fuera de esa respuesta
  -> buscar la clave en el catálogo
  -> sendTemplate
  -> si Graph rechaza, devolver el error y no reintentar solo
```

No vamos a calcular la ventana de 24 horas para esta PoC. La respuesta al mensaje entrante siempre es texto. La plantilla entra solo por una llamada explícita, no desde el `onMessage` por defecto.

## Alta, cuando se implemente

1. Crear la plantilla en el administrador de WhatsApp, categoría utilidad, idioma `es_AR`, cuerpo con `{{1}}`, `{{2}}`, etc.
2. Esperar a que quede aprobada. Hasta ese momento el POST falla.
3. Copiar el nombre y el idioma al catálogo, en el mismo orden de variables.
4. Probar con un número de prueba de la app, no desde el eco automático.

La primera plantilla de prueba sería `aviso_prueba`, con un solo parámetro `nombre` y el cuerpo de arriba. No se manda sola: haría falta un disparo aparte, por ejemplo un script o una ruta local que no está en este diseño.

## Qué queda afuera

Encabezados con imagen, botones, carruseles, plantillas de autenticación y la API para crear o listar plantillas. Si el texto aprobado usa parámetros con nombre en vez de `{{1}}`, el objeto `parameters` cambia y hay que ajustar el helper. Este diseño usa la forma posicional, que es la que cubre la prueba.
