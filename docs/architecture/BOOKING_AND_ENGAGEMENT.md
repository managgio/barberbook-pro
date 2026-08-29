# Booking y engagement

## Disponibilidad y reservas

El motor `booking/domain/services/availability-engine.ts` combina:

- horario del local y del profesional;
- turnos, pausas, buffer y overflow controlado;
- festivos generales y por profesional;
- citas existentes con duración real;
- `BookingClosure` persistidos para periodos operativamente bloqueados.

Los casos de uso single y batch comparten el mismo motor. La creación y edición de citas vuelven a comprobar disponibilidad en la operación protegida, por lo que la regla se aplica a clientes, invitados, admins y cualquier canal futuro.

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

Las notificaciones usan una outbox multicanal tenant-scoped:

1. la creación, edición, cancelación o confirmación de pago guarda el correo en la misma transacción que el cambio de la cita;
2. correo, SMS y WhatsApp se envían después del commit o desde trabajos tenant-scoped, nunca dentro de una transacción de negocio larga;
3. una clave de idempotencia estable evita duplicados;
4. los fallos transitorios se reintentan con backoff y lotes acotados;
5. los rechazos definitivos quedan visibles, pero no generan ruido crítico global;
6. los fallos graves de configuración y los transitorios que agotan reintentos se promueven a trazas críticas.

`accepted` significa que SMTP o Twilio aceptaron la solicitud. No equivale a lectura ni a entrega final si el proveedor no ofrece webhooks de eventos. El historial tenant muestra solo incidencias de métodos habilitados, destinatario enmascarado, código seguro, intentos y acción manual de reintento. Platform dispone de la vista cross-tenant paginada y filtrable por método, tenant y local, siempre protegida por `PlatformAdminGuard`.

Los recordatorios y comunicados de SMS/WhatsApp pasan por la misma outbox. Marcar un recordatorio como procesado significa que quedó persistido de forma durable; sus reintentos posteriores son responsabilidad del worker. La retención anonimiza datos personales una vez dejan de ser operativamente útiles.

Las reservas de invitado guardan `guestEmail` y `guestPhone` por separado. `guestContact` se conserva temporalmente como puente de compatibilidad y la migración rellena los campos estructurados desde los datos existentes.

En procesos masivos también se registra por destinatario si fue enviado, falló, fue excluido o se canceló su cita.

## Pruebas críticas

- motor de disponibilidad e intervalos solapados;
- single/batch availability y comprobación final de reserva;
- scope Prisma de citas y cierres;
- idempotencia de comunicados;
- invitados y contactos inválidos;
- cancelación de todas las citas aunque el cliente estuviera notificado;
- expiración/deduplicación de avisos de hueco.
- outbox multicanal idempotente, backoff, clasificación SMTP/Twilio, retención y promoción crítica;
- contacto estructurado de invitados y confirmación después de pago Stripe.
