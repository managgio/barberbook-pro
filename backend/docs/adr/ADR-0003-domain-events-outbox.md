# ADR-0003: Domain Events Sync Ahora + Outbox Despues

- Status: Accepted
- Date: 2026-03-04

## Context
Necesitamos migrar incrementalmente sin rehacer infraestructura de eventos de golpe.

## Decision
- Fase inicial: handlers sincronos en el mismo proceso para side effects.
- Introducir Outbox cuando write path de Booking+Commerce este estable (target: despues de Fase 5).

## Consequences
- Entrega mas rapida en primeras fases.
- Riesgo controlado de acoplamiento temporal en side effects.
- Plan claro para evolucionar a entrega fiable asincrona.

## Implementation update - 2026-08-29

El write path de Booking y Commerce ya está estabilizado y se activa la implementación de la fase outbox multicanal:

- `NotificationDelivery` se persiste junto al cambio de cita o pago;
- SMTP y Twilio se ejecutan después del commit o desde trabajos tenant-scoped;
- las claves de idempotencia evitan duplicados;
- un worker tenant-scoped recupera pendientes y aplica backoff acotado;
- cada intento queda auditado y solo los fallos operativamente graves se promueven a trazas críticas;
- los datos personales se anonimizan con plazos distintos para éxitos y fallos, y el comprobante técnico expira después.

Esta implementación cubre correo, SMS y WhatsApp. No introduce todavía un bus genérico para todos los eventos de dominio.
