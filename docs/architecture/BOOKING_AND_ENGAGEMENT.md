# Booking y engagement

## Disponibilidad y reservas

En la vista de cliente, la acción de añadir una cita al calendario adapta el destino al dispositivo: Android usa el enlace de evento de Google Calendar y Apple/macOS recibe un archivo iCalendar compatible con Calendar. El evento conserva inicio y fin en UTC, ubicación, servicio y profesional sin depender de la zona horaria del navegador para serializarlo.

El motor `booking/domain/services/availability-engine.ts` combina:

- horario del local y del profesional;
- turnos, pausas, buffer y overflow controlado;
- festivos generales y por profesional;
- citas existentes con duración real;
- `BookingClosure` persistidos para periodos operativamente bloqueados.

Los casos de uso single y batch comparten el mismo motor. La creación y edición de citas vuelven a comprobar disponibilidad en la operación protegida, por lo que la regla se aplica a clientes, invitados, admins y cualquier canal futuro.

La reserva de varios servicios usa una capacidad jerárquica. Platform debe habilitar `features.multiServiceBookingEnabled` para la marca y, solo entonces, el tenant puede activar `appointments.multiServiceEnabled`. Si cualquiera de los dos flags está desactivado, la UI y el backend conservan el flujo de un único servicio.

Una selección múltiple pertenece a una sola cita, un cliente y un profesional. `Appointment.totalDurationMinutes` guarda la suma y `AppointmentServiceItem` conserva el orden, nombre, duración y precio de cada servicio. El profesional debe estar habilitado para todos los servicios y el motor exige un intervalo continuo por la duración total, respetando horarios, pausas, buffer, festivos, cierres y citas existentes. La creación vuelve a validar la misma selección dentro de la frontera transaccional. Ventajas, cupones y suscripciones se aplican al servicio principal; los servicios adicionales mantienen su precio calculado.

En las superficies administrativas, la cita múltiple sigue siendo una sola cita para estado, cliente, profesional, ingresos y ticket medio. La UI desglosa sus servicios en orden, muestra la duración de cada uno y explica la duración agregada como bloque continuo. El importe de `Appointment.price` es el total autoritativo de la cita; los precios de `AppointmentServiceItem` y los productos sirven para explicar su composición. El mix analítico cuenta cada servicio realizado por separado. Editar metadatos, productos, profesional u horario sin cambiar el selector de servicio conserva el bloque completo y usa su duración agregada para consultar y validar disponibilidad.

La edición conjunta de horario y pausas del local se persiste mediante una sola escritura del agregado `ShopSchedule`. El adapter sincroniza después `SiteSettings.openingHours`; la UI no debe lanzar en paralelo ambos endpoints contra los mismos registros.

Las aperturas extraordinarias forman parte de `ShopSchedule` y se administran desde una vista dedicada de Configuración. Cada entrada pertenece al local del request, identifica una fecha civil, define turno de mañana y/o tarde y se aplica a todos los profesionales activos o a una selección tenant-scoped. La apertura sustituye el horario semanal del profesional solo para esa fecha y selección. Los festivos generales o del profesional, los `BookingClosure`, las pausas, las citas existentes y los límites de contratación siguen teniendo prioridad. La escritura usa un endpoint dedicado para no sobrescribir accidentalmente pausas, tolerancias u horario semanal, y las escrituras generales de horario preservan estas aperturas.

Antes de guardar, la UI consulta un resumen seguro de conflictos para el local actual. El resumen solo expone si existe festivo o cierre general y los IDs de profesionales seleccionados con un bloqueo, sin datos de otros tenants ni información personal.

`BookingClosure` usa intervalos `[startDateTime, endDateTime)`, puede ser general (`barberId = null`) o de un profesional y siempre está tenant-scoped. Los cierres se consultan por solapamiento e índice de local/fechas.

## Festivos

Antes de crear un festivo se calcula el impacto sobre citas existentes. El administrador puede:

- no crear el festivo;
- crearlo conservando las citas;
- comunicar y cancelar las citas, creando el bloqueo correspondiente.

Un festivo bloquea disponibilidad por fecha. Para periodos parciales se usa `BookingClosure`, no un festivo de día completo.

## Comunicados con cancelación

`comunicar_y_cancelar` se ejecuta de inmediato y no admite `all_clients`. Al confirmar:

1. se resuelve el alcance tenant-scoped;
2. se persiste idempotentemente el cierre exacto de agenda antes de cancelar;
3. se cancela cada cita afectada, incluso si ese cliente ya había sido notificado;
4. se intenta el envío por el canal seleccionado y se registra el resultado individual;
5. se guarda resumen, auditoría y estado final.

Los alcances se traducen así:

- día/rango de días → cierre general de días completos;
- mañana/tarde → límites del turno configurado;
- rango horario → intervalo exacto;
- uno/varios profesionales → cierre diario por profesional;
- citas seleccionadas → intervalo de cada cita y su duración.

Aunque no haya citas existentes, el periodo queda bloqueado para nuevas reservas. Los locks y el vínculo a `campaignId` evitan cierres duplicados en reintentos.

## Aviso de hueco anterior

Una cita puede solicitar aviso si aparece un hueco anterior. La preferencia está asociada a la cita, funciona con usuario o invitado, se evalúa al liberarse disponibilidad y deja de ser útil al llegar/pasar la fecha de la cita. Las notificaciones usan las preferencias/contacto disponibles y guardan la oportunidad notificada para evitar duplicados.

## Notificaciones

Los casos de uso consumen puertos de engagement; los adapters resuelven configuración efectiva por tenant. Los fallos de proveedor no deben corromper el estado de la cita.

Los conflictos HTTP 400 esperados al volver a validar una reserva, como un hueco ocupado o un profesional incompatible con el servicio, se muestran al usuario y permanecen en las métricas API. No se registran como trazas críticas de frontend. Los fallos inesperados sí conservan el recorrido crítico completo.

Las notificaciones usan una outbox multicanal tenant-scoped:

1. la creación, edición, cancelación o confirmación de pago guarda el correo en la misma transacción que el cambio de la cita;
2. correo, SMS y WhatsApp se envían después del commit o desde trabajos tenant-scoped, nunca dentro de una transacción de negocio larga;
3. una clave de idempotencia estable evita duplicados;
4. los fallos transitorios se reintentan con backoff y lotes acotados;
5. los rechazos definitivos quedan visibles, pero no generan ruido crítico global;
6. los fallos graves de configuración y los transitorios que agotan reintentos se promueven a trazas críticas.

`accepted` significa que el transporte o gateway aceptó la solicitud. No equivale a lectura ni a entrega final; en SMS, el callback firmado del proveedor puede promover después el estado a entregado o no entregado. El historial tenant muestra solo incidencias de métodos habilitados, destinatario enmascarado, código seguro, intentos y acción manual de reintento. Platform dispone de la vista cross-tenant paginada y filtrable por método, tenant y local, siempre protegida por `PlatformAdminGuard`.

Una entrega crítica se promueve una sola vez por `NotificationDelivery`. Un reintento manual conserva la marca de promoción para no duplicar la misma incidencia en el informe.

La elegibilidad del reintento manual se calcula en backend y se entrega a la UI. En SMS nunca permite eludir un opt-out ni repetir destinatarios inválidos, mensajes demasiado largos o fallos permanentes de autenticación, remitente y configuración. La API vuelve a aplicar la regla aunque el cliente invoque el endpoint directamente y protege la transición con compare-and-set sobre estado, error, contador y referencia del intento activo, para que una operación concurrente o un callback antiguo no pueda apropiarse del nuevo intento.

El reintento reproduce el snapshot inmutable de destinatario y contenido persistido en la entrega original. No reconstruye el mensaje desde datos de contacto que hayan cambiado después. Si el destinatario era ausente o inválido, corregir el contacto requiere que el flujo propietario encole una entrega nueva tenant-scoped; el incidente anterior permanece como evidencia y no se habilita para reintento.

Los recordatorios y comunicados de SMS/WhatsApp pasan por la misma outbox. Un recordatorio se marca como procesado solo cuando al menos uno de sus canales permitidos quedó persistido de forma durable; sus reintentos posteriores son responsabilidad del worker. La clave idempotente del recordatorio incluye el inicio de la cita y la revisión estable del snapshot: ejecuciones repetidas de la misma revisión no duplican el envío, pero una cita reprogramada puede generar su nuevo recordatorio. Si un canal permitido no está operativo, no se consume el recordatorio. La retención anonimiza datos personales una vez dejan de ser operativamente útiles.

La capacidad pública efectiva se expone como `config.notificationCapabilities`, sin secretos. SMS requiere opt-in tenant, producción, credenciales globales, `Messaging Service` y callback HTTPS; WhatsApp se calcula por separado con su preferencia y configuración global. Los SMS rutinarios están bloqueados fuera de producción tanto en el scheduler como en el gateway. La única excepción es el envío de prueba explícito de Platform en local.

Las reservas de invitado guardan `guestEmail` y `guestPhone` por separado. `guestContact` se conserva temporalmente como puente de compatibilidad y la migración rellena los campos estructurados desde los datos existentes.

Los recordatorios de invitados requieren consentimiento explícito por cita mediante `reminderChannels`. La ausencia del campo y una lista vacía significan que no existe opt-in. El backend solo acepta `sms` o `whatsapp` si `notificationCapabilities` confirma que el canal está habilitado y operativo para el tenant, y existe un teléfono válido; persiste cada elección por separado en `Appointment`. Para usuarios registrados siguen mandando las preferencias de su perfil, nunca los flags de invitado. El checkout Stripe conserva exactamente la misma selección al crear la cita pendiente.

El recordatorio de una cita invitada puede incluir `/cita/:token`, un enlace de gestión firmado con HMAC y ligado a marca, local, cita y expiración. El token vence 48 horas después del inicio de la cita, no contiene PII y no se persiste. La API pública solo devuelve servicio, profesional, fecha, duración, estado y política de cancelación. Las respuestas usan `Cache-Control: no-store` y `Referrer-Policy: no-referrer`, y la aplicación aplica también una política global `no-referrer`, para evitar que la URL bearer se propague como referencia. Una firma manipulada, expirada, usada desde otro tenant o asociada a un usuario registrado produce la misma respuesta 404. La cancelación es idempotente, usa el caso de uso normal de actualización para conservar stock, recompensas, avisos y demás efectos, y vuelve a aplicar estado, fecha y `cancellationCutoffHours`.

En procesos masivos también se registra por destinatario si fue enviado, falló, fue excluido o se canceló su cita.

## Preguntas frecuentes de la landing

`engagement` es propietario de las FAQ. Platform activa `BrandConfig.features.faqEnabled`; la ausencia del flag equivale a `false` y los overrides locales no pueden habilitarlo. Desactivar la capacidad conserva preguntas, orden y traducciones, pero oculta el editor y la sección pública. Platform mantiene el orden y la visibilidad de la sección `faq` dentro de la configuración habitual de landing.

Los editores FAQ y galería se agrupan en Página Web. Sus endpoints administrativos y el control de publicación exigen además `WebsiteAccessGuard`; habilitar este acceso no cambia la publicación ni sustituye las capacidades de marca. La lectura pública mantiene sus condiciones existentes.

- `GET /faqs` entrega las preguntas del local actual en el idioma solicitado, con fallback al texto fuente. Devuelve una lista vacía si la capacidad está desactivada o el administrador ha ocultado la publicación.
- `/admin/faqs` exige `AdminEndpoint` y la capacidad activa. Permite listar originales, crear, editar y eliminar. `PATCH /admin/faqs/order` recibe `expectedIds` y `orderedIds`; ambos deben corresponder a la colección completa del local.
- La colección admite hasta 50 preguntas; pregunta y respuesta se limitan a 240 y 5000 caracteres. Se persiste texto plano y el frontend no interpreta HTML.
- Todas las escrituras bloquean la fila del local en una transacción MySQL. Crear añade al final, editar/eliminar exige la `version` leída y ordenar compara el orden esperado. Un conflicto devuelve HTTP 409 sin sobrescribir cambios de otro administrador. El backend ignora la identidad tenant del cliente y utiliza exclusivamente el contexto resuelto.
- Guardar contenido y sus fuentes de traducción es atómico. Eliminar borra sus fuentes y traducciones dentro de la misma transacción. El worker de IA guarda mediante compare-and-set sobre tenant, estado pendiente, bloqueo manual, fecha de revisión y versión fuente; un resultado de una pregunta modificada o eliminada se descarta sin abortar el lote.
- La traducción automática requiere tanto la capacidad FAQ como la configuración de IA activa. Las traducciones manuales bloqueadas se conservan como obsoletas tras cambiar el original y no se publican hasta su revisión. Las rutas genéricas de localización también rechazan FAQ si la capacidad está desactivada.

## Galería y publicación de contenido

`engagement` también gestiona la galería del local. `BrandConfig.features.galleryEnabled` nace en `false`, es autoritativo a nivel de marca y no admite activación mediante override local. Su desactivación bloquea los endpoints administrativos, las traducciones y la lectura pública, conservando el contenido.

- `GET /gallery` devuelve categorías y trabajos traducidos del local actual. La lectura pública es de solo lectura y devuelve colecciones vacías si la capacidad está desactivada o la sección no está publicada.
- `/admin/gallery/items` y `/admin/gallery/categories` requieren `AdminEndpoint`. Los trabajos tienen título (120 caracteres), descripción opcional (2000), categoría obligatoria y foto de resultado; la foto anterior es opcional. Cada local dispone de un cupo independiente de 12 imágenes de galería, incluidos trabajos sin publicar. Una marca con cinco locales puede usar hasta 60 imágenes, con un máximo de 12 en cada local. Cada foto asignada a un trabajo cuenta una plaza; una comparación antes/después consume dos. Se conservan 24 categorías por local, con nombres de hasta 80 caracteres y unicidad local sin distinguir mayúsculas según la collation de MySQL.
- `GET /admin/gallery` añade `imageUsage: {used, limit}` con el agregado del local resuelto en el request; nunca devuelve trabajos ni consume cupo de otros locales. La lectura pública no expone ese agregado. El backend valida la capacidad en la misma transacción de alta/edición, contando el reemplazo por diferencia y devolviendo `GALLERY_IMAGE_LIMIT` (400) cuando aumenta el uso por encima del cupo. Las colecciones anteriores que excedan 12 se conservan y admiten mantenimiento o reducción, nunca ampliación. El máximo técnico de lectura de 100 trabajos se mantiene para poder administrar ese contenido anterior.
- La categoría debe pertenecer al mismo local, también mediante FK compuesta. Solo se pueden eliminar categorías vacías. Editar y eliminar exige versión; ordenar mediante `PATCH /admin/gallery/items/order` exige una instantánea exacta y una permutación completa. El bloqueo del local serializa las altas, ediciones y eliminaciones concurrentes que consumen el mismo cupo, sin bloquear la marca completa. Eliminar libera las plazas de ese local. Los errores de concurrencia devuelven 409.
- Las fuentes `gallery_item` (título/descripción) y `gallery_category` (nombre) se guardan o eliminan atómicamente con el contenido. La traducción manual y la automática siguen la política existente; el worker excluye en la consulta las capacidades desactivadas y conserva su protección compare-and-set.
- `/admin/landing-sections/:section`, para `faq` o `gallery`, separa la capacidad de Platform de la publicación decidida por el admin. GET devuelve `{published, version}` y PATCH exige ambos campos. Un registro ausente tiene versión 0: FAQ publicada por compatibilidad con su comportamiento anterior, galería oculta hasta publicación explícita. El backend comprueba la publicación antes de devolver contenido público. Ocultar conserva todos los borradores, traducciones y orden; el editor permanece disponible mientras Platform lo permita.
- El orden y `hiddenSections` de Platform continúan determinando la composición de la landing. Activar la publicación desde el admin no modifica esos ajustes.

## Pruebas críticas

- motor de disponibilidad e intervalos solapados;
- aperturas extraordinarias en días semanalmente cerrados, selección de profesionales y prioridad de festivos/cierres;
- single/batch availability y comprobación final de reserva;
- selección múltiple jerárquica, compatibilidad del profesional y duración continua agregada;
- scope Prisma de citas y cierres;
- idempotencia de comunicados;
- invitados y contactos inválidos;
- cancelación de todas las citas aunque el cliente estuviera notificado;
- expiración/deduplicación de avisos de hueco.
- outbox multicanal idempotente, backoff, clasificación SMTP/Twilio, retención y promoción crítica;
- contacto estructurado de invitados y confirmación después de pago Stripe.

## Solicitudes de reseña y feedback privado

El programa existente pertenece al local. Solo genera solicitudes tras una cita completada, con el mínimo de visitas, retraso y cooldown configurados. La capacidad de Platform (`adminSidebar.hiddenSections`) y `ReviewProgramConfig.enabled` se comprueban al generar, consultar y actuar. Desactivarlo conserva el histórico, pero detiene el flujo cliente.

Los endpoints `/reviews/*` exigen sesión y derivan `userId` del token verificado. Los identificadores y contactos enviados en query/body nunca autorizan acceso. Cada lectura, lock y escritura conserva `localId` y ownership. Los contactos de invitados se conservan desde `guestEmail`/`guestPhone`, con fallback legacy, pero conocer un contacto no permite consultar ni modificar sus solicitudes. El cliente actual ofrece el modal a usuarios autenticados; un canal para invitados requeriría verificación independiente.

La creación bloquea la fila del local dentro de una transacción para serializar también el cooldown entre dos citas distintas del mismo cliente. Las acciones bloquean la solicitud tenant-scoped antes de aplicar `review-request-policy`, sin llamadas externas dentro de la transacción. Los reintentos no duplican aplazamientos ni feedback; eventos tardíos no degradan estados finales. Las solicitudes `SHOWN` y `RATED` siguen siendo recuperables tras recargar. Un aplazamiento con contador igual al máximo todavía puede mostrarse; expira al intentar aplazarlo otra vez. Una cita que ya no está completada no se ofrece ni admite acciones.

Todas las puntuaciones reciben las mismas opciones de abrir Google y enviar feedback privado. Un clic solo demuestra apertura del enlace, nunca publicación de una reseña. Esta separación evita la solicitud selectiva de reseñas positivas prohibida por la [política de Google Maps](https://support.google.com/contributionpolicy/answer/7400114). El feedback privado sigue siendo privado y no alimenta ninguna landing.

El modal recibe la copia localizada mediante el circuito existente de traducciones; el editor administrativo conserva el idioma fuente al guardar. El contrato de actualización excluye IDs de servidor y valida textos anidados, HTTPS y límites numéricos. El modal se reinicia por usuario, local e idioma y descarta respuestas tardías del contexto anterior; no interrumpe la reserva. Puede cerrarse aunque falle el aplazamiento, avisando del error sin bloquear al cliente.

Las métricas usan una cohorte de solicitudes creadas en el periodo y cuentan su evolución. Los filtros de fecha incluyen el día completo en la zona horaria del local. La tasa es clics a Google entre solicitudes mostradas de esa cohorte. El listado privado incluye cualquier puntuación, pagina en servidor y refresca filtros y totales al resolver una entrada.
