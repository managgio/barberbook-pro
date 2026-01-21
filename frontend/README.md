# Frontend - Asistente IA (Admin)

Este frontend incluye el panel del **Asistente IA** para administradores. Está diseñado para crear citas y festivos de forma rápida y fiable.

## Capacidades actuales del chat

El asistente crea citas nuevas y añade festivos/vacaciones. Si falta información, pide solo el dato pendiente y continúa.

## Ejemplos de preguntas

- "Añade festivo el 5 de mayo"
- "Vacaciones para Juan del 10 al 12 de junio"
- "Crea cita para Marta el 20 de mayo a las 18:00 con corte clásico y barbero Luis"
- "Crea una cita para Álvaro el viernes que viene a las 10:30 con barba y barbero Sergio"

## UX del panel

- Botón flotante para abrir el asistente
- Modal amplio con el chat
- Botones de plantilla para crear cita o festivo
- Historial del chat persistente por sesión
- Entrada por audio con transcripción automática
- Escuchar respuestas desde el chat (si el navegador lo soporta)

## Seguridad

- Sin exposición de claves en frontend
- Sin acceso directo a BD desde el modelo
- Respuestas sin PII de clientes

## Nota

El asistente solo usa herramientas autorizadas. Si falta información, lo pedirá antes de crear.
