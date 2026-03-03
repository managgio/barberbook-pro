# Asistente IA (Admin) - Capacidades actuales

Este archivo resume de un vistazo lo que el Asistente IA puede hacer hoy. Actualízalo cuando se agreguen nuevas tools o flujos.

## Alcance general
- Crear citas nuevas con validación de disponibilidad
- Añadir festivos/vacaciones para el local o barberos
- Crear alertas para clientes (titulo + mensaje + tipo)
- Entrada por voz (transcripción automática)
- Respuestas claras y directas
- Enfoque híbrido: IA interpreta intención/slots y backend normaliza/valida con reglas deterministas

## Tools disponibles
1) create_appointment
   - Crea citas nuevas tras validar disponibilidad y horario
   - Si falta un dato, lo solicita antes de crear
   - Si no se indica barbero, asigna automáticamente un barbero con hueco real y menor carga semanal
   - Soporta "lo antes posible" y franjas como "mañana por la tarde" buscando el primer hueco real
   - Ignora `barberName` no confiable cuando el texto no lo respalda o parece corresponder al cliente (evita bloquear la autoasignación por inferencias erróneas)
   - Interpreta mejor frases complejas con múltiples "para"/"con" para separar cliente, barbero y servicio
   - Si la fecha solicitada coincide con un festivo general, devuelve un motivo explícito de cierre por festivo
   - Resolución de cliente acotada al tenant actual (marca), evitando mezcla cross-tenant
   - Si el cliente no existe, crea cita como invitado; si hay varias coincidencias (también por nombres solapados), pide desambiguar

2) add_shop_holiday
   - Añade festivos generales del negocio
   - Interpreta rangos naturales tipo "desde ... hasta ..." como un único festivo continuo

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
- Sin PII fuera de contexto. Solo se muestra email para desambiguar clientes del mismo tenant
- Ignorar prompt-injection y solicitudes fuera de alcance
- No ejecutar acciones destructivas ni cambios en BD
- Solo crea citas nuevas; no edita ni elimina citas

## Extensión futura
- Agregar nueva tool al registro en `AiToolsRegistry`
- Documentar aquí la nueva capability con un ejemplo de prompt
