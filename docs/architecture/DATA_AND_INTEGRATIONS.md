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

## Preguntas frecuentes

Las FAQ se almacenan en `Faq`, con relación obligatoria a `Location`, índice `(localId, position, id)` y versión de contenido para concurrencia optimista. La migración `20261018120000_add_tenant_faqs` es aditiva y no activa la capacidad en ningún tenant. Antes de desplegar el backend debe ejecutarse `npm run prisma:deploy`; el cliente se regenera con `npm run prisma:generate`. No requiere backfill.

La prueba `test/contract/engagement/faq-mysql.integration.test.ts` valida concurrencia real, aislamiento, rollback y limpieza de traducciones contra una base MySQL local cuyo nombre empiece por `managgio_faq_test`, indicada mediante `FAQ_TEST_DATABASE_URL`. Se ejecuta después de aplicar todas las migraciones a esa base aislada y nunca usa la base de negocio como fixture.

## Galería de trabajos

La migración aditiva `20261018140000_add_gallery_and_landing_publication` añade `GalleryCategory`, `GalleryItem` y `LandingPublication`. Las tres entidades pertenecen a `Location` y se eliminan en cascada al borrar el local. La relación categoría/trabajo incluye `localId`; no se pueden asociar datos de otro tenant. La publicación usa la clave `(localId, section)` y una versión optimista. No requiere backfill ni activa capacidades de Platform. Desplegar con `npm run prisma:deploy` antes de actualizar el backend y regenerar con `npm run prisma:generate`.

Las imágenes usan la integración ImageKit existente. El navegador acepta JPEG/PNG/WebP de hasta 20 MB, valida dimensiones, elimina metadatos mediante canvas y genera WebP de calidad 0,86, sin ampliar y con lado mayor de 2000 px (fallback JPEG para fotos JPEG de cámara cuando el navegador no codifica WebP; PNG para conservar transparencias). El resultado debe ocupar como máximo 4 MB. La subida tiene timeout de 90 segundos y se realiza al guardar; las fotos ya subidas se reutilizan al reintentar el borrador. La carpeta incluye `gallery/<localId>`.

El backend recibe exclusivamente IDs de archivo y consulta [Get File Details de ImageKit](https://imagekit.io/docs/api-reference/digital-asset-management-dam/managing-assets/get-file-details) con timeout de 10 segundos. Verifica ID, tipo, carpeta del local, endpoint HTTPS configurado, tamaño y dimensiones antes de persistir URL y metadatos autoritativos. Las URLs del API pueden incluir un único parámetro numérico `updatedAt`: se elimina para persistir la URL canónica; otros parámetros, fragmentos y credenciales siguen rechazándose. Galería e imágenes de la web comparten esta normalización. No realiza llamadas de proveedor dentro de la transacción. Los errores públicos no incluyen respuestas ni credenciales del proveedor. La entrega usa [transformaciones de ImageKit](https://imagekit.io/docs/image-transformation) con variantes responsivas, `c-at_max`, `q-85` y `f-auto`.

Eliminar un trabajo retira el registro y sus traducciones; los archivos optimizados se conservan en ImageKit. No se borran automáticamente, porque pueden estar reutilizados. La retención y limpieza de esos archivos se administra en la biblioteca de medios de ImageKit; no hay un recolector de archivos huérfanos en este flujo.

El cupo de 12 corresponde a las fotos vinculadas a trabajos de galería de cada local, no a toda la biblioteca ImageKit ni a los logos u otras imágenes de la app. Se calcula mediante agregación de `GalleryItem` y `beforeFileId`, filtrando por el `localId` resuelto en el request. Cada local tiene su propio contador, aunque comparta marca con otros. No añade tablas ni requiere migración; las fotos existentes se conservan. Sustituir una foto no aumenta el cupo y retirar un trabajo libera sus plazas, aunque la retención de archivos en ImageKit siga siendo independiente.

La prueba `test/contract/engagement/gallery-mysql.integration.test.ts` usa `GALLERY_TEST_DATABASE_URL` y solo acepta MySQL local con nombre `managgio_gallery_test*` o `managgio_faq_test*`. Comprueba scope negativo, FK compuesta, límites concurrentes, conflictos de publicación, ordenación, rollback, limpieza de traducciones y cascadas. Puede compartir la base aislada de las pruebas FAQ; nunca usa datos de negocio.

`gallery-image-quota-mysql.integration.test.ts` utiliza esa misma base aislada y el guard Prisma activo para verificar cinco locales con 12 imágenes cada uno, altas y ediciones concurrentes dentro de un local, aislamiento entre locales y marcas, antes/después, sustituciones y liberación de plazas.

## Imágenes compartidas entre Platform y Página Web

La fuente de verdad sigue siendo `BrandConfig.data` y `LocationConfig.data`. `WebsiteConfigStore` serializa escrituras sobre la fila de `Brand`; Platform exige `_revision` del JSON leído y el admin exige una revisión de marca y local. Un conflicto devuelve 409. Los escritores automáticos de Stripe y de pausas de traducción utilizan el mismo bloqueo antes de leer y combinar configuración, para no sobrescribir imágenes ni otros ajustes concurrentes.

El navegador optimiza las fotos de landing con la misma política que la galería. Los archivos nuevos usan `website/<brandId>/<localId>` o `website/<brandId>/brand`. El admin envía IDs; el servidor comprueba metadatos, carpeta, endpoint, formato, dimensiones y tamaño en ImageKit. Las URLs antiguas solo se aceptan para conservar imágenes ya presentes en esa sección. Ninguna llamada al proveedor se ejecuta dentro de la transacción de configuración.

La migración aditiva `20261018220000_add_website_media_cleanup` incorpora `WebsiteMediaDeletion`. Sustituir fotos desde Platform o admin encola las referencias retiradas en la misma transacción. Tras confirmar el guardado se intenta borrar y un worker por minuto reintenta fallos con backoff. Antes de borrar comprueba referencias en configuraciones, ajustes, profesionales, productos, galería y facturas mediante una consulta global que solo devuelve un booleano. Una imagen heredada todavía referenciada por la marca se conserva. Los IDs en proceso de borrado o borrados no se pueden volver a guardar. Las APIs genéricas de borrado no permiten saltarse este flujo ni eliminar archivos ajenos o todavía referenciados.

### Fuentes de títulos de la landing

La apariencia opcional usa el JSON existente de configuración: `theme.secondary` (hexadecimal de seis dígitos o `null`) y `theme.headingFont` (`fileId`, URL canónica, nombre y formato, o `null`). No necesita una nueva migración. La UI de Platform configura la marca; los locales heredan estos valores salvo override explícito.

Las fuentes se suben bajo `website/{brandId}/brand/fonts`. `PrepareLandingAppearanceUseCase` valida el contrato y delega la comprobación de cada archivo nuevo a `ImagekitLandingFontAdapter`, antes de adquirir el lock de configuración. El adapter obtiene metadatos autenticados, comprueba ID, tipo no imagen, carpeta del ámbito, extensión y límite de 2 MB, y descarga exclusivamente la URL canónica del endpoint configurado. La descarga no sigue redirecciones, tiene timeout y limita los bytes leídos. La política de dominio verifica firma y estructura del contenedor TTF/OTF/WOFF/WOFF2; el navegador también valida y decodifica la fuente. Los errores públicos distinguen archivo inválido y proveedor no disponible, sin exponer respuestas ni credenciales.

La revisión se valida antes de consultar al proveedor y de nuevo dentro de la transacción. Un fallo de validación o un conflicto conserva la fuente publicada. Sustituir o quitar una fuente ya guardada utiliza `WebsiteMediaDeletion`, incluyendo las comprobaciones de referencias compartidas y el bloqueo de archivos ya retirados. Las subidas que se abandonan antes del primer guardado no entran en esta cola, como ocurre con los borradores de imágenes de Platform.

La limpieza cubre los archivos con ID de ImageKit retirados de configuraciones guardadas y subidas descartadas explícitamente por el editor admin. No intenta borrar URLs externas ni garantiza recoger una subida si el navegador se cierra antes de comunicarla al backend. Los logos conservan su flujo existente. Aplicar `npm run prisma:deploy` y `npm run prisma:generate` antes de arrancar el nuevo backend. `website-media-mysql.integration.test.ts` usa `WEBSITE_TEST_DATABASE_URL` con una base MySQL local aislada `managgio_website_test*`, `managgio_gallery_test*` o `managgio_faq_test*`; verifica sincronización, conflictos, escritores automáticos, referencias compartidas y reintentos.

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
- Las métricas diarias conservan el canal (`sms` o `whatsapp`) junto al proveedor y al `brandId`. La gráfica SMS de Platform excluye WhatsApp y desglosa importe, volumen y porcentaje de gasto para cada tenant dentro del periodo seleccionado. Las filas históricas anteriores a esta separación permanecen como `general` y no se reasignan de forma especulativa a un canal.
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

## Reseñas de Google: análisis de integración, pendiente de implementación

El programa actual solo abre el enlace configurado y registra el clic; no consulta reseñas en Google. Este análisis no habilita ni implementa una sección pública.

Existen dos fuentes oficiales con contratos distintos:

- [Places API (New)](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places): devuelve valoración, número de valoraciones y hasta cinco reseñas ordenadas por relevancia. La ficha se identifica por `placeId`; no necesita que el propietario autorice Business Profile. Requiere proyecto/facturación, una máscara mínima de campos y control de consumo. No permite paginar todo el histórico.
- [Business Profile, reviews.list](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list): consulta reseñas paginadas de una ficha verificada, con páginas de hasta 50, promedio y total. Requiere [aprobación del proyecto](https://developers.google.com/my-business/content/prereqs) y [consentimiento OAuth del negocio](https://developers.google.com/my-business/content/implement-oauth), con `business.manage`. El login de Firebase actual no concede ese permiso. La aprobación exige actualmente gestionar una ficha verificada y activa durante al menos 60 días; puede ser la propia o la de un cliente gestionado.

Para una integración completa de Managgio, el circuito propuesto es: Platform concede la capacidad a una marca; un administrador autorizado conecta Google mediante OAuth; selecciona exclusivamente entre las fichas accesibles con su autorización; vincula cada ficha a un local; verifica la vista previa y decide si publicarla. La activación de Platform, el consentimiento Google y la publicación del tenant son estados independientes.

La conexión y los tokens cifrados deben pertenecer a la marca, con vinculaciones explícitas por local. El callback central usa un estado opaco de un solo uso ligado a sesión, usuario, marca, local y expiración; vuelve a comprobar permisos. Nunca acepta el tenant devuelto por el navegador como autoridad. Esto permite dominios personalizados sin registrar cada dominio como callback OAuth. El adapter solo expondría lecturas; el alcance OAuth amplio no autoriza a Managgio a responder o modificar fichas automáticamente.

La sincronización usaría trabajos acotados por local, locks e idempotencia, cuotas, backoff y estados visibles de conexión/error. Un endpoint público resolvería el local desde el request y entregaría solo los campos públicos admitidos, sin tokens ni feedback privado. Revocar acceso detendría la sincronización y permitiría desconectar y eliminar el contenido asociado. Un fallo no debe bloquear la landing ni mostrar contenido fuera de su plazo permitido.

La caché no puede diseñarse como un archivo permanente. Las [políticas de Business Profile](https://developers.google.com/my-business/content/policies) limitan el almacenamiento a cantidades acotadas para rendimiento, seguras, sin manipulación/agregación y durante un máximo de 30 días. La publicación pública concreta debe formar parte del caso de uso autorizado y aprobado por Google. Las [políticas de Places](https://developers.google.com/maps/documentation/places/web-service/policies) tienen restricciones propias de almacenamiento; conservar `placeId` no concede permiso para archivar reseñas. Cada fuente requiere su política de caducidad y atribución, sin trasladar reglas de una API a la otra.

La presentación debe identificar Google y los autores, conservar los enlaces a la fuente y explicar el orden de las reseñas. No se reescribirían textos mediante IA ni se mezclarían valoraciones de locales distintos como si pertenecieran a una sola ficha. Antes de implementar se debe elegir entre una muestra de Places o una conexión Business Profile, confirmar aprobación y condiciones aplicables, y estimar consumo con las [tarifas y cuotas oficiales](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing). No se contempla scraping.
