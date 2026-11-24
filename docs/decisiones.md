# Decisiones abiertas

La PoC deja un default en cada tema para que se pueda correr ya. Lo que sigue es lo que hay que cerrar antes de meter esto en un proyecto más grande. Cada ítem se puede tachar o reescribir en este archivo.

## 1. Forma de distribución

Default: un repo Node, sin dependencias, importable y también ejecutable.

Hay que elegir cómo lo va a consumir el resto:

- paquete git o npm privado (`whatsapp-autoreply`)
- carpeta `src/` copiada al otro repo
- servicio HTTP interno, y el otro proyecto solo le manda la regla de respuesta

La tercera opción cambia el contrato: el handler dejaría de vivir en el mismo proceso. Hoy el handler es una función local a propósito, porque es lo más fácil de probar y de mover.

## 2. Dónde vive la regla de respuesta

Default: `onMessage` en el proceso del bot. El ejemplo saluda con el nombre y repite el texto.

Pregunta: la regla queda en este repo, o este repo solo transporta WhatsApp y la decisión de qué decir la toma otro servicio (ERP, automatización, un modelo)?

Si la responde otro servicio, este módulo debería recibir la URL y el timeout de ese servicio, y definir qué pasa cuando tarda o falla. Hoy un fallo de envío a Meta devuelve `500` para que Meta reintente. Un fallo de la regla propia todavía no tiene política.

## 3. Estado de la conversación

Default: ninguno. Cada mensaje se contesta solo.

Hace falta estado si la respuesta depende de lo anterior (un turno, un número de trámite, un menú). Opciones razonables: memoria del proceso, Postgres, o el sistema que ya tenga el proyecto anfitrión. No vale la pena elegir una base hasta saber qué hay que recordar.

## 4. Idempotencia

Default: un `Set` en memoria, 1000 ids, se pierde al reiniciar.

Para producción hay que persistir los ids ya contestados. Si no, un reinicio en el medio de un reintento de Meta duplica la respuesta. La clave natural es el `wamid`.

## 5. Ventana de 24 horas y plantillas

Default: solo mensajes de texto libres, como respuesta a un mensaje entrante.

Alcanza mientras el bot nunca inicie la conversación. En el momento en que haya avisos, recordatorios o recontactos, entran las plantillas aprobadas por Meta y otro tipo de payload. El cliente ya tiene `send(payload)` para no cerrar esa puerta, pero no hay un helper de plantillas.

## 6. Tipos de mensaje

Default: se lee y se contesta `text`. Una imagen, un audio o un botón se reciben, quedan en `message.raw` y no generan respuesta.

Definir el orden en que importan: botones y listas, imágenes, documentos, ubicación, reacciones.

## 7. Cuentas y números

Default: un token y un `PHONE_NUMBER_ID` por proceso.

Si el mismo servicio va a atender más de un número, la config deja de ser un solo entorno y pasa a ser una tabla. El `phoneNumberId` ya viaja en cada mensaje, así que el webhook único podría enrutar. Falta decidir si eso es necesario en la primera integración real.

## 8. Seguridad del webhook

Default: la firma se valida solo si hay app secret. Sin secret, el proceso avisa y acepta el POST.

Para cualquier deploy alcanzable desde internet, `WHATSAPP_APP_SECRET` tiene que ser obligatorio. También falta definir quién puede llamar a `/health` y si el webhook va a estar detrás de un allow list.

## 9. Operación

Default: log a stdout, sin el texto del chat, y `GET /health`.

Falta elegir dónde corre (una VM, un contenedor al lado de otra API, un PaaS) y cómo se rota el token. El `Dockerfile` está para poder llevarlo como servicio, no porque el destino ya esté elegido.

## 10. Proveedor

Default: Cloud API de Meta, directa, sin BSP.

Twilio, 360dialog u otro proveedor cambian el sobre del webhook y la URL de envío. Este código no intenta abstraerlos. Si el primer proyecto real ya entra por un BSP, el cliente y el parser se reemplazan y el contrato de `onMessage` puede quedar.
