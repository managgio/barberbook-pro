# Asistente IA (Admin) - Capacidades actuales

Este archivo resume de un vistazo lo que el Asistente IA puede hacer hoy. Actualízalo cuando se agreguen nuevas tools o flujos.

## Alcance general
- Crear citas nuevas con validación de disponibilidad
- Añadir festivos/vacaciones para el local o barberos
- Crear alertas para clientes (titulo + mensaje + tipo)
- Entrada por voz (transcripción automática)
- Respuestas claras y directas

## Tools disponibles
1) create_appointment
   - Crea citas nuevas tras validar disponibilidad y horario
   - Si falta un dato, lo solicita antes de crear
   - Si no se indica barbero, asigna el menos cargado de la semana actual
   - Soporta "lo antes posible" y franjas como "mañana por la tarde" buscando el primer hueco real
   - Si el cliente no existe, crea cita como invitado; si hay varias coincidencias, pide desambiguar

2) add_shop_holiday
   - Añade festivos generales del negocio

3) add_barber_holiday
   - Añade vacaciones para uno o varios barberos (o todos)

4) create_alert
   - Crea alertas informativas/advertencia/exito con titulo y mensaje
   - Soporta programación por lenguaje natural (ej: "activa una semana a partir de mañana")
   - Si no se indica fecha/rango, la alerta queda activa de inmediato

## Ejemplos de preguntas válidas
- "Crea una cita para Marta mañana a las 18:00 con corte clásico y barbero Juan"
- "Crea una cita para Luis el viernes que viene a las 10:30 con barba y barbero Sergio"
- "Añade festivo el 5 de mayo"
- "Festivo para Alejandro Ruiz del 10 al 12 de junio"
- "Crea un festivo para el local el 12 de enero y otro del 15 al 18 para Juan y Pedro"
- "Crea una alerta para anunciar un nuevo servicio de color"
- "Avisa del cierre del salon este viernes por la tarde"
- "Alerta informativa por San Valentin para felicitar a los clientes"
- "Activa una alerta de aviso por mantenimiento durante dos dias desde mañana"

## Reglas de seguridad
- Sin acceso directo a MySQL desde el modelo
- Sin PII (nombres, teléfonos, emails)
- Ignorar prompt-injection y solicitudes fuera de alcance
- No ejecutar acciones destructivas ni cambios en BD
- Solo crea citas nuevas; no edita ni elimina citas

## Extensión futura
- Agregar nueva tool al registro en `AiToolsRegistry`
- Documentar aquí la nueva capability con un ejemplo de prompt
