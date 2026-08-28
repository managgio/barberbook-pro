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
- `GeneralHoliday` / `BarberHoliday` bloquean fechas.
- `BookingClosure` bloquea intervalos y enlaza su `CommunicationCampaign` de origen.
- Campañas, ejecuciones y resultados de destinatario conservan trazabilidad de comunicaciones.

## Correo SMTP

La configuración efectiva puede variar por marca/local. El transporte se cachea por `brandId:localId` y huella de host, puerto, usuario y contraseña, de modo que un cambio de credenciales entra en vigor sin reiniciar y nunca reutiliza el transporte de otro local.

- `535`, `EAUTH` o “Username and Password not accepted” significan fallo de autenticación del remitente, no dirección destinataria inválida.
- Verifica usuario SMTP, contraseña o app password, host, puerto y políticas del proveedor.
- El `From` técnico usa la cuenta autenticada; el contacto comercial se muestra en contenido.
- Los logs usan `SMTP_AUTH_FAILED`, tenant y usuario enmascarado; no incluyen contraseña ni destinatario.

## Otras integraciones

- Firebase: autenticación cliente y verificación server-side; los bypass de desarrollo están bloqueados en producción.
- Twilio: SMS/WhatsApp con configuración tenant-scoped y métricas de uso.
- Stripe: pagos/webhooks con validación de firma, idempotencia y pruebas críticas.
- ImageKit: almacenamiento/media mediante adapters.
- OpenAI: orquestación y herramientas detrás de puertos, límites y métricas.

No llames SDKs desde dominio o UI. Encapsula cada proveedor en un adapter y prueba el contrato con fakes.

## Secretos y observabilidad

- Secretos solo en entorno/configuración privada; nunca en git, respuesta HTTP o logs.
- Evita correos/teléfonos completos en logs.
- Incluye correlation ID, brand/local y código seguro de proveedor.
- Diferencia errores transitorios, configuración inválida y rechazo definitivo para permitir reintentos seguros.

Los Web Vitals con rating `poor` se conservan para análisis, pero no generan correo por sí solos. El correo queda reservado a valores que superan los umbrales críticos operativos configurables mediante `OBSERVABILITY_ALERT_WEB_VITAL_CRITICAL_*`; el cooldown predeterminado es de seis horas por métrica y tenant, sin distinguir ruta. El asunto y el inicio del cuerpo deben identificar primero el nombre de la marca. El nombre y el ID del local solo se incluyen cuando la marca tiene más de un local activo.
