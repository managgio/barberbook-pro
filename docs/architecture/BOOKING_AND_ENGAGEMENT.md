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

Los casos de uso consumen puertos de engagement; los adapters resuelven configuración efectiva por tenant. Los fallos de proveedor no deben corromper el estado de la cita. En procesos masivos sí se registra por destinatario si fue enviado, falló, fue excluido o se canceló su cita.

## Pruebas críticas

- motor de disponibilidad e intervalos solapados;
- single/batch availability y comprobación final de reserva;
- scope Prisma de citas y cierres;
- idempotencia de comunicados;
- invitados y contactos inválidos;
- cancelación de todas las citas aunque el cliente estuviera notificado;
- expiración/deduplicación de avisos de hueco.
