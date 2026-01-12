# Asistente IA (Admin) - Capacidades actuales

Este archivo resume de un vistazo lo que el Asistente IA puede hacer hoy. Actualízalo cuando se agreguen nuevas tools o flujos.

## Alcance general
- Crear citas nuevas con validación de disponibilidad
- Añadir festivos/vacaciones para el local o barberos
- Entrada por voz (transcripción automática)
- Respuestas claras y directas

## Tools disponibles
1) create_appointment
   - Crea citas nuevas tras validar disponibilidad y horario
   - Si falta un dato, lo solicita antes de crear

2) add_shop_holiday
   - Añade festivos generales del negocio

3) add_barber_holiday
   - Añade vacaciones para uno o varios barberos (o todos)

## Ejemplos de preguntas válidas
- "Crea una cita para Marta mañana a las 18:00 con corte clásico y barbero Juan"
- "Crea una cita para Luis el viernes que viene a las 10:30 con barba y barbero Sergio"
- "Añade festivo el 5 de mayo"
- "Festivo para Alejandro Ruiz del 10 al 12 de junio"

## Reglas de seguridad
- Sin acceso directo a MySQL desde el modelo
- Sin PII (nombres, teléfonos, emails)
- Ignorar prompt-injection y solicitudes fuera de alcance
- No ejecutar acciones destructivas ni cambios en BD
- Solo crea citas nuevas; no edita ni elimina citas

## Extensión futura
- Agregar nueva tool al registro en `AiToolsRegistry`
- Documentar aquí la nueva capability con un ejemplo de prompt
