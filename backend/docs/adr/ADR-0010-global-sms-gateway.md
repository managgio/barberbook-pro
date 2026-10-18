# ADR-0010: Gateway SMS global con remitente único

- Estado: Aprobado
- Fecha: 2026-10-17
- Relacionado con: ADR-0003, ADR-0004, ADR-0006, ADR-0008

## Contexto

Los recordatorios SMS son una capacidad de producto de Managgio, no una integración propiedad de cada tenant. Guardar credenciales, remitentes o conceptos de Twilio en la configuración tenant acoplaría el dominio al proveedor, multiplicaría estados inválidos y permitiría identidades de remitente incoherentes.

También se requiere impedir envíos rutinarios durante el desarrollo local, ofrecer una prueba manual controlada y conocer el resultado final de una entrega sin confiar solo en la aceptación inicial del gateway.

## Decisión

1. Engagement depende de los puertos `SmsGateway` y `WhatsappGateway`. Los SDK, errores y firmas concretas de Twilio quedan confinados a adapters de infraestructura.
2. Las credenciales y el `Messaging Service` son globales. El remitente visible único es `MANAGGIO`; el adapter fuerza conjuntamente `MessagingServiceSid` y `From: MANAGGIO`, y ningún tenant almacena credenciales ni elige remitente.
3. El tenant únicamente activa o desactiva la capacidad funcional. La capacidad pública efectiva combina esa preferencia con la disponibilidad real del gateway, sin revelar secretos.
   La preferencia SMS nace en `false` y la migración de adopción desactiva las marcas existentes; Platform debe habilitarlas de forma explícita después de validar el alta del remitente y el presupuesto.
4. Los SMS rutinarios usan una política fail-closed: solo pueden salir con `NODE_ENV=production`, configuración completa y callback HTTPS válido. El scheduler y el propio gateway aplican la restricción.
5. La única excepción es `platform_test`. Requiere Platform Admin, runtime local, hostname localhost o loopback y conexión procedente de loopback. No existe prueba SMS tenant y la herramienta aplica cooldown para evitar gasto accidental.
6. Todo envío declara su propósito, normaliza el destinatario a E.164 y respeta el límite global de tres segmentos. El recordatorio usa una plantilla GSM-7 de hasta dos segmentos.
7. La aceptación del gateway no equivale a entrega. Un webhook con firma válida traduce los estados del proveedor al contrato neutral `sent`, `delivered`, `undelivered` o `failed`, con transiciones monotónicas y correlación mediante un identificador opaco. `failed` no registra el SMS como enviado.
8. Las métricas se registran mediante casos de uso neutrales de mensajería. El valor `twilio` que todavía exista en almacenamiento es compatibilidad de infraestructura y no forma parte de la lógica de negocio.

## Consecuencias

- Sustituir el proveedor requiere implementar los puertos y su traducción de errores, sin cambiar casos de uso, scheduler, consentimiento o configuración tenant.
- Un fallo o una configuración incompleta no consume el recordatorio: solo se marca procesado después de persistir al menos un canal en la outbox.
- El nombre alfanumérico es unidireccional. Los mensajes indican que no se responda y, para invitados, incluyen un enlace firmado de gestión.
- El remitente `MANAGGIO` debe estar registrado donde lo exija el país y añadido como único emisor apto al `Messaging Service` de producción.
- Si `MANAGGIO` no pertenece al Sender Pool del `Messaging Service`, el rechazo del proveedor se clasifica como `SMS_SENDER_INVALID`, permanente y crítico, sin reintentos automáticos ni manuales.
- Antes de activar una marca, Platform debe enviar la prueba local al país objetivo y confirmar que el remitente real devuelto por el proveedor coincide con `MANAGGIO`. Una discrepancia bloquea el checklist operativo y obliga a revisar el Sender Pool; no existe fallback tenant.
- Los países o redes que no admitan el remitente alfanumérico deben rechazarse de forma observable o incorporarse mediante una decisión operativa posterior; no se introduce un remitente tenant como fallback.
