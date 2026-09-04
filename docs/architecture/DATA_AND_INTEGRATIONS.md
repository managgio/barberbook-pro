# Datos e integraciones

## Prisma y MySQL

`backend/prisma/schema.prisma` es el modelo declarativo y cada cambio se entrega con una migración SQL versionada en `backend/prisma/migrations/`.

Flujo obligatorio:

1. modificar el schema;
2. crear/revisar la migración, incluyendo índices y claves foráneas;
3. ejecutar `npm run prisma:generate`;
4. probar contra MySQL compatible;
5. ejecutar typecheck, contract tests y comprobación tenant-scope;
6. desplegar con `prisma migrate deploy`, nunca con `db push` en producción.

Las columnas de tiempo se guardan en UTC. Las fechas civiles y horarios se interpretan con la zona del negocio (`Europe/Madrid` por defecto) mediante las utilidades del proyecto. Los rangos operativos parciales son semiabiertos `[start, end)`.

## Relaciones clave

- `Brand` → `Location` delimita tenancy.
- `BrandUser` asocia usuarios a una marca.
- `LocationStaff` concede administración local.
- `Appointment` referencia local, profesional, servicio y usuario o contacto invitado.
- `Appointment.guestEmail` y `Appointment.guestPhone` son la fuente estructurada para invitados; `guestContact` sigue como compatibilidad temporal.
- `GeneralHoliday` / `BarberHoliday` bloquean fechas.
- `BookingClosure` bloquea intervalos y enlaza su `CommunicationCampaign` de origen.
- Campañas, ejecuciones y resultados de destinatario conservan trazabilidad de comunicaciones.
- `NotificationDelivery` y `NotificationDeliveryAttempt` forman la outbox multicanal e historial técnico tenant-scoped de correo, SMS y WhatsApp.

## Correo SMTP

La configuración efectiva puede variar por marca/local. El transporte se cachea por `brandId:localId` y huella de host, puerto, usuario y contraseña, de modo que un cambio de credenciales entra en vigor sin reiniciar y nunca reutiliza el transporte de otro local.

- `535`, `EAUTH` o “Username and Password not accepted” significan fallo de autenticación del remitente, no dirección destinataria inválida.
- Verifica usuario SMTP, contraseña o app password, host, puerto y políticas del proveedor.
- Las app passwords de Google se normalizan eliminando sus espacios de agrupación. Las contraseñas de otros proveedores solo eliminan espacios exteriores.
- El puerto 587 exige STARTTLS y el 465 usa TLS implícito. El transporte exige TLS 1.2 como mínimo y aplica timeouts acotados.
- Platform nunca devuelve la contraseña SMTP persistida. Solo informa `passwordConfigured` y conserva el secreto si el campo queda vacío.
- Una modificación de usuario, contraseña, host o puerto se autentica con `verify()` antes de persistirse. Platform también ofrece una prueba manual que reutiliza de forma segura el secreto guardado.
- El `From` técnico usa la cuenta autenticada; el contacto comercial se muestra en contenido.
- Los logs usan `SMTP_AUTH_FAILED`, tenant y usuario enmascarado; no incluyen contraseña ni destinatario.
- Un `sendMail` sin excepción no basta: si el proveedor devuelve destinatarios rechazados, la entrega se clasifica como `EMAIL_RECIPIENT_REJECTED`.

### Estados de entrega multicanal

- `pending`: persistido y pendiente de primer intento.
- `processing`: reclamado por un worker.
- `accepted`: aceptado por SMTP o Twilio, sin afirmar lectura ni entrega final.
- `retrying`: fallo transitorio con próximo intento programado.
- `failed`: fallo definitivo o reintentos agotados.
- `skipped`: no se intentó por preferencia desactivada o falta de destinatario.

El worker procesa una vez por minuto, usa lock distribuido y consulta únicamente entregas vencidas de marcas/locales activos. Cada fila recupera su contexto tenant antes de enviarse y el lote queda limitado a 100 elementos. Correo, SMS y WhatsApp comparten clasificación, backoff, idempotencia, intentos y promoción a trazas críticas. Las cargas incluyen una clave de idempotencia cuyo valor persistido está hasheado. El payload necesario para reintentar nunca se escribe en logs ni respuestas HTTP.

Las confirmaciones de cita se encolan dentro de la transacción de reserva. El intento inmediato se lanza en segundo plano y la respuesta HTTP no espera al proveedor; si el proceso se interrumpe, el worker recupera la entrega persistida. Un fallo SMTP nunca revierte ni invalida una reserva confirmada.

### Retención y minimización

La vista operativa muestra por defecto solo incidencias: pendientes, procesando, reintentando, fallidas y omisiones accionables. Los éxitos no se usan como listado principal.

- aceptadas y omitidas: detalle completo durante 14 días;
- fallidas: detalle completo durante 90 días;
- después del plazo: se eliminan destinatario, nombre, payload, mensajes, IDs de proveedor e intentos;
- el comprobante técnico anonimizado se conserva hasta 365 días y después se elimina;
- `pending`, `processing` y `retrying` nunca se limpian por antigüedad.

La limpieza diaria usa lock distribuido y lotes de 500, con un máximo acotado por ejecución para evitar transacciones gigantes y poder absorber más de un lote diario.

## Otras integraciones

- Firebase: autenticación cliente y verificación server-side; los bypass de desarrollo están bloqueados en producción.
- Twilio: SMS/WhatsApp con configuración tenant-scoped, outbox compartida y métricas de uso.
- Stripe: pagos/webhooks con validación de firma, idempotencia y pruebas críticas.
- ImageKit: almacenamiento/media mediante adapters.
- OpenAI: orquestación y herramientas detrás de puertos, límites y métricas.

No llames SDKs desde dominio o UI. Encapsula cada proveedor en un adapter y prueba el contrato con fakes.

## Secretos y observabilidad

- Secretos solo en entorno/configuración privada; nunca en git, respuesta HTTP o logs.
- Evita correos/teléfonos completos en logs.
- Incluye correlation ID, brand/local y código seguro de proveedor.
- Diferencia errores transitorios, configuración inválida y rechazo definitivo para permitir reintentos seguros.
- Las vistas operativas devuelven destinatarios enmascarados y mensajes saneados. El tenant solo puede consultar el local actual y los métodos habilitados en su configuración efectiva. Solo Platform puede consultar el agregado, filtrable por método, tenant y local.

Los Web Vitals con rating `poor` se conservan para análisis, pero no generan correo por sí solos. El correo queda reservado a valores que superan los umbrales críticos operativos configurables mediante `OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_*`; el cooldown predeterminado es de seis horas por métrica y tenant, sin distinguir ruta. El asunto y el inicio del cuerpo deben identificar primero el nombre de la marca. El nombre y el ID del local solo se incluyen cuando la marca tiene más de un local activo.
