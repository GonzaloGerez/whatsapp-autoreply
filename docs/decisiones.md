# Decisiones

Esta PoC es para pruebas. Corre como servicio Docker en esta PC. Lo que sigue es lo que quedó cerrado y lo que sigue abierto.

## 1. Forma de distribución

No se define. No vamos a elegir todavía si esto se publica como paquete, si se copia `src/` a otro repo o si otro sistema le manda la regla de respuesta.

## 2. Dónde vive la regla de respuesta

Las respuestas viven en este proyecto, y solo para probar. El proceso de `src/server.ts` contesta con el menú de [recetas.md](recetas.md): el inventario está en `src/recipes.ts`. El eco de `defaultReply` queda en la librería, para cuando nadie pasa un `onMessage`.

Si más adelante hay que escalar o integrarlo a otro sistema, la regla deja de vivir acá y se busca otra forma. Hasta ese momento no hay un servicio externo, ni URL, ni timeout para una regla ajena.

## 3. Estado de la conversación

Una contestación por mensaje, sin memoria. Si el texto es el número o el nombre de una receta, se manda esa preparación. Cualquier otro texto recibe la lista completa. No se guarda si el menú ya se mostró.

## 4. Idempotencia

Sigue abierto. El default no cambió: un `Set` en memoria, 1000 ids, se pierde al reiniciar. Un reinicio en el medio de un reintento de Meta puede duplicar la respuesta. La clave natural, cuando se cierre, es el `wamid`.

## 5. Ventana de 24 horas y plantillas

El bot de prueba sigue contestando solo con texto libre, dentro de la ventana que abre el mensaje entrante. Las plantillas no se implementan todavía. El diseño de cómo quedarían integradas está en [plantillas.md](plantillas.md).

## 6. Tipos de mensaje

Solo texto. Una imagen, un audio o un botón se puede recibir y queda en `message.raw`, pero no se contesta.

## 7. Cuentas y números

Un solo número. Un `WHATSAPP_ACCESS_TOKEN` y un `WHATSAPP_PHONE_NUMBER_ID` por proceso. No hay tabla de cuentas ni ruteo por número.

## 8. Seguridad del webhook

Cuando el webhook sea alcanzable desde internet, `WHATSAPP_APP_SECRET` es obligatorio y un POST sin firma válida se rechaza.

Esta corrida es local, en la PC, y no está publicada. Puede arrancar sin secret: el proceso avisa en el log y acepta el POST. Falta definir quién puede llamar a `/health` y si el webhook va a tener un allow list. Eso queda para cuando salga de la máquina.

## 9. Operación

Servicio Docker en esta PC, para pruebas. La imagen no instala paquetes: Node ejecuta los TypeScript directo.

```bash
cp .env.example .env
# completar token, phone number id y verify token cuando haya una app de Meta
docker compose up -d --build
```

Queda en `http://localhost:3000`. `GET /health` responde `{ "ok": true }`. El webhook es `http://localhost:3000/webhook`. Meta no puede llegar a localhost; para una prueba real hace falta un túnel y los valores de la app en `.env`.

Los logs no incluyen el texto del chat. Cómo se rota el token queda para más adelante.

## 10. Proveedor

Se ve más adelante. Mientras tanto sigue la Cloud API de Meta, directa, sin BSP. Twilio, 360dialog u otro proveedor cambian el webhook y la URL de envío, y este código no los abstrae.
