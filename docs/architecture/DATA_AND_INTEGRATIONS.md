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
- `AppointmentServiceItem` conserva el desglose inmutable de una reserva múltiple; `Appointment.totalDurationMinutes` es la duración autoritativa usada al calcular solapamientos.
- `Appointment.guestEmail` y `Appointment.guestPhone` son la fuente estructurada para invitados; `guestContact` sigue como compatibilidad temporal.
- `Appointment.reminderSmsRequested` y `Appointment.reminderWhatsappRequested` conservan el opt-in explícito por canal de una reserva invitada. Ambos nacen en `false`; no se deduce consentimiento a partir de tener teléfono.
- `GeneralHoliday` / `BarberHoliday` bloquean fechas.
- `BookingClosure` bloquea intervalos y enlaza su `CommunicationCampaign` de origen.
- Campañas, ejecuciones y resultados de destinatario conservan trazabilidad de comunicaciones.
- `NotificationDelivery` y `NotificationDeliveryAttempt` forman la outbox multicanal e historial técnico tenant-scoped de correo, SMS y WhatsApp.
- `Invoice` conserva una instantánea de empresa, cliente, servicio, importes y branding al emitir una factura de cita. `InvoiceSequence` asigna una numeración anual por marca dentro de una transacción serializable.

## Facturación de citas

Platform activa la capacidad en `BrandConfig.invoicing`. La emisión exige nombre legal, NIF/CIF y dirección en `BrandLegalSettings`, y solo está disponible en rutas administrativas tenant-scoped. Una cita genera como máximo una factura: las repeticiones devuelven el mismo documento y número.

Cuando la capacidad está activa, el administrador del tenant completa esos datos fiscales en Configuración mediante `/admin/invoicing/settings`; Platform no los edita. Si la capacidad está desactivada, el formulario y todas las acciones de factura permanecen ocultos. Solo las citas `scheduled` y `completed` permiten emitir una factura; `cancelled` y `no_show` se rechazan también en backend.

El precio de la cita se trata como total con IVA incluido. La factura persiste base imponible, tipo, cuota y total redondeados a dos decimales, además de la identidad y el logo efectivos en el momento de emisión. El PDF se compone en el cliente desde esta instantánea y puede descargarse o compartirse mediante la API nativa del dispositivo.

## Correo SMTP

La configuración efectiva puede variar por marca/local. El transporte se cachea por `brandId:localId` y huella de host, puerto, usuario y contraseña, de modo que un cambio de credenciales entra en vigor sin reiniciar y nunca reutiliza el transporte de otro local.

- `535`, `EAUTH` o “Username and Password not accepted” significan fallo de autenticación del remitente, no dirección destinataria inválida.
- Verifica usuario SMTP, contraseña o app password, host, puerto y políticas del proveedor.
- Las app passwords de Google se normalizan eliminando sus espacios de agrupación y deben tener exactamente 16 caracteres. Una forma inválida se rechaza antes de abrir la conexión y Platform la muestra como estado seguro sin exponer el secreto. Las contraseñas de otros proveedores solo eliminan espacios exteriores.
- El puerto 587 exige STARTTLS y el 465 usa TLS implícito. El transporte exige TLS 1.2 como mínimo y aplica timeouts acotados.
- Platform nunca devuelve la contraseña SMTP persistida. Solo informa `passwordConfigured` y conserva el secreto si el campo queda vacío.
- Una modificación de usuario, contraseña, host o puerto se autentica con `verify()` antes de persistirse. Platform también ofrece una prueba manual que reutiliza de forma segura el secreto guardado.
- El `From` técnico usa la cuenta autenticada; el contacto comercial se muestra en contenido.
- Las plantillas HTML resuelven el color y el modo desde `theme`, y el logo desde el `branding` efectivo del tenant. Si falta el color se usa el tono neutro de Managgio, nunca el branding de otro tenant. En modo oscuro se prioriza `logoDarkUrl`; en modo claro, `logoLightUrl`, ambos con fallback seguro.
- La paleta de correo declara el `color-scheme` efectivo y mantiene fondos, texto, paneles, bordes y enlaces con contraste propio para modo claro u oscuro.
- Los logos HTTPS del endpoint ImageKit configurado se transforman a un PNG acotado y se adjuntan con CID para que los clientes de correo no dependan de la carga de imágenes remotas. Un logo HTTPS externo se referencia como imagen remota y nunca se descarga desde el backend; URLs no HTTPS se omiten.
- Los logs usan `SMTP_AUTH_FAILED`, tenant y usuario enmascarado; no incluyen contraseña ni destinatario.
- Un `sendMail` sin excepción no basta: si el proveedor devuelve destinatarios rechazados, la entrega se clasifica como `EMAIL_RECIPIENT_REJECTED`.

### Estados de entrega multicanal

- `pending`: persistido y pendiente de primer intento.
- `processing`: reclamado por un worker.
- `accepted`: aceptado por el transporte o gateway, sin afirmar lectura ni entrega final.
- `sent`: el proveedor confirma que el SMS salió hacia la red de destino.
- `delivered`: el proveedor confirma la entrega final del SMS.
- `undelivered`: la red de destino rechazó o no pudo entregar el SMS.
- `retrying`: fallo transitorio con próximo intento programado.
- `failed`: fallo definitivo o reintentos agotados.
- `skipped`: no se intentó por preferencia desactivada o falta de destinatario.

El worker procesa una vez por minuto, usa lock distribuido y consulta únicamente entregas vencidas de marcas/locales activos. Cada fila recupera su contexto tenant antes de enviarse y el lote queda limitado a 100 elementos. Correo, SMS y WhatsApp comparten clasificación, backoff, idempotencia, intentos y promoción a trazas críticas. Las cargas incluyen una clave de idempotencia cuyo valor persistido está hasheado. El payload necesario para reintentar nunca se escribe en logs ni respuestas HTTP.

Las confirmaciones de cita se encolan dentro de la transacción de reserva. El intento inmediato se lanza en segundo plano y la respuesta HTTP no espera al proveedor; si el proceso se interrumpe, el worker recupera la entrega persistida. Un fallo SMTP nunca revierte ni invalida una reserva confirmada.

### Retención y minimización

La vista operativa muestra por defecto solo incidencias: pendientes, procesando, reintentando, fallidas y omisiones accionables. Los éxitos no se usan como listado principal.

- aceptadas, enviadas, entregadas y omitidas: detalle completo durante 14 días;
- no entregadas y fallidas: detalle completo durante 90 días;
- después del plazo: se eliminan destinatario, nombre, payload, mensajes, IDs de proveedor e intentos;
- el comprobante técnico anonimizado se conserva hasta 365 días y después se elimina;
- `pending`, `processing` y `retrying` nunca se limpian por antigüedad.

La limpieza diaria usa lock distribuido y lotes de 500, con un máximo acotado por ejecución para evitar transacciones gigantes y poder absorber más de un lote diario.

## Otras integraciones

- Firebase: autenticación cliente y verificación server-side; los bypass de desarrollo están bloqueados en producción.
- Mensajería: dominio y aplicación dependen de puertos `SmsGateway` y `WhatsappGateway`; Twilio queda confinado a adapters de infraestructura y el almacenamiento de métricas conserva el nombre legacy solo como compatibilidad.
- SMS usa credenciales y `Messaging Service` globales, con remitente único `MANAGGIO`. El adapter declara tanto el `MessagingServiceSid` como `From: MANAGGIO`, que debe pertenecer al Sender Pool, para impedir que el proveedor seleccione otro emisor. El tenant solo controla su preferencia funcional; no puede persistir credenciales ni seleccionar remitente.
- SMS nace desactivado y requiere activación explícita por Platform para cada marca. La migración de adopción apaga todas las marcas y elimina overrides locales heredados, evitando que cargar credenciales globales dispare gasto o mensajes de forma masiva.
- Los SMS rutinarios solo están operativos en producción cuando credenciales, `Messaging Service` y callback HTTPS están configurados. En local se bloquean incluso si un caller invoca directamente el gateway; únicamente Platform puede lanzar la prueba explícita local.
- La prueba manual exige a la vez runtime local, host `localhost` o loopback, conexión de red procedente de loopback y sesión Platform Admin. No existe endpoint de prueba tenant. Un entorno remoto con `NODE_ENV=development` no puede usarla ni falseando el encabezado `Host`. La herramienta aplica cooldown y muestra el remitente real devuelto por el gateway; debe coincidir con `MANAGGIO` antes de activar una marca.
- El callback de estado valida la firma del proveedor contra la URL pública exacta y solo actualiza una entrega SMS cuyo identificador opaco y `providerMessageId` coinciden. Las transiciones son monotónicas para impedir que un callback tardío degrade un estado final.
- Todo SMS se valida antes del gateway: E.164 entre 8 y 15 dígitos, código de país iniciado entre 1 y 9 y un máximo de tres segmentos. La plantilla de recordatorio se normaliza a GSM-7 y se limita a dos segmentos; los comunicados no se transforman silenciosamente.
- Si el proveedor todavía no devuelve precio, `TWILIO_SMS_COST_USD` se interpreta como coste por segmento y se multiplica por la segmentación calculada. WhatsApp usa su propio fallback `TWILIO_WHATSAPP_COST_USD`; nunca se imputa el coste SMS a otro canal.
- El presupuesto operativo usa el nombre neutral `MESSAGING_DAILY_BUDGET_USD`; `TWILIO_DAILY_BUDGET_USD` solo se admite como compatibilidad legacy en el adapter de métricas.
- WhatsApp conserva configuración global independiente y cruza su propio puerto, sin acoplar los casos de uso al SDK.
- Stripe: pagos/webhooks con validación de firma, idempotencia y pruebas críticas.
- ImageKit: almacenamiento/media mediante adapters.
- OpenAI: orquestación y herramientas detrás de puertos, límites y métricas.

Los mensajes del asistente registran el origen de la entrada (`typed`, `voice` o `template`) y, cuando corresponde, la clave de plantilla. La consola Platform puede leer conversaciones de todos los tenants mediante un puerto cross-tenant explícito protegido por `PlatformAdminGuard`; el tenant nunca recibe ese acceso agregado. Un trabajo diario elimina globalmente sesiones y mensajes con más de 90 días, incluidos los de locales inactivos.

No llames SDKs desde dominio o UI. Encapsula cada proveedor en un adapter y prueba el contrato con fakes.

## Secretos y observabilidad

- Secretos solo en entorno/configuración privada; nunca en git, respuesta HTTP o logs.
- `GUEST_APPOINTMENT_LINK_SECRET` es global, debe contener al menos 32 bytes y es obligatorio en producción. Si falta o es débil fuera de producción, no se generan ni aceptan enlaces de gestión; nunca se usa un fallback conocido.
- Evita correos/teléfonos completos en logs.
- Incluye correlation ID, brand/local y código seguro de proveedor.
- Diferencia errores transitorios, configuración inválida y rechazo definitivo para permitir reintentos seguros.
- Las vistas operativas devuelven destinatarios enmascarados y mensajes saneados. El tenant solo puede consultar el local actual y los métodos habilitados en su configuración efectiva. Solo Platform puede consultar el agregado, filtrable por método, tenant y local.
- El histórico parte de las incidencias para reducir ruido y permite incluir explícitamente estados resueltos para auditar aceptación, envío y entrega final.

Los Web Vitals con rating `poor` se conservan para análisis, pero no generan correo por sí solos. La salud visible del informe se clasifica con el P75 y los umbrales estándar de cada métrica, de modo que una muestra aislada no convierte todo el periodo en crítico. El correo queda reservado a valores que superan los umbrales críticos operativos configurables mediante `OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_*`; el cooldown predeterminado es de seis horas por métrica y tenant, sin distinguir ruta. El asunto y el inicio del cuerpo deben identificar primero el nombre de la marca. El nombre y el ID del local solo se incluyen cuando la marca tiene más de un local activo.
