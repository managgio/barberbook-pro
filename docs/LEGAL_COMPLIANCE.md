# Legal compliance (GDPR/LOPDGDD)

Este documento describe como configurar la capa legal y de privacidad por marca en Managgio.

## Configuracion por marca (Plataforma)
Ruta: **Platform > Brands > Legal**

Campos clave:
- **Datos del titular**: nombre legal, NIF/CIF, direccion, email y telefono de contacto.
- **Pais**: codigo ISO (por defecto `ES`).
- **Transparencia IA**: toggle y lista de proveedores separados por coma.
- **Subprocesadores**: lista editable con nombre, finalidad, pais, tipos de datos y enlace.
- **Secciones personalizadas**: secciones extra por politica (titulo + markdown).
- **Retencion (dias)**: activa anonimizado automatico de citas antiguas (opcional).

Boton **Subir version**:
- Incrementa la version de cada politica. Afecta a nuevos consentimientos; no modifica consentimientos historicos.

Nota:
- La edicion de textos legales queda restringida a plataforma (Managgio). Los admins de negocio no tienen acceso.

## Paginas legales publicas
Rutas tenant-aware (subdominio o dominio custom):
- `/legal/privacy`
- `/legal/cookies`
- `/legal/notice`

Cada pagina muestra:
- Version y fecha efectiva.
- Identidad del titular (datos legales).
- Secciones en markdown.
- Subprocesadores (privacidad) y bloque de transparencia IA.

## Consentimiento en reservas
Al crear una reserva (cliente o invitado) se requiere aceptar la Politica de Privacidad.
Se guarda un **ConsentRecord** con:
- Marca/local, fecha, version de politica.
- Texto del consentimiento.
- `ipHash` (si existe `IP_HASH_SALT`).
- `userAgent` recortado.

## Retencion y anonimizado
Si `retentionDays` esta configurado:
- Un cron diario anonimiza citas antiguas por local.
- Se reemplazan `guestName` y `guestContact`, se limpia `notes`, y se guarda `anonymizedAt`.
- Se registra evento en AuditLog.

## DPA (plataforma)
Ruta: **Platform > Brands > Legal**

La plataforma muestra el DPA generado y permite editar subprocesadores y datos legales para cada marca.

## Defaults seguros
Si una marca no configura datos legales:
- Se usa el nombre de la marca como titular.
- Contacto se rellena con el email configurado en SiteSettings si existe.
- Subprocesadores y proveedores IA tienen valores por defecto.

## Variables de entorno
Backend:
- `IP_HASH_SALT`: sal para hashear IP en consentimientos.
