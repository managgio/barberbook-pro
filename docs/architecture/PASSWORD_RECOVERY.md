# Recuperación de contraseña por correo

## Flujo y propiedad

La persona que no recuerda su contraseña abre `¿Has olvidado tu contraseña?` en `/auth`. El formulario conserva el correo del login, permite corregirlo y envía la solicitud mediante el SDK Firebase ya utilizado para autenticarse. El correo se normaliza; la contraseña nunca se recorta ni transforma.

Firebase Authentication es la autoridad para emitir, caducar y consumir el código de un solo uso y cambiar la contraseña. No se introduce otra tabla de credenciales, endpoint público, secreto, migración o integración SMTP. Las preferencias de notificaciones del negocio no impiden recuperar el acceso.

Con la configuración estándar del proyecto, el correo abre el formulario seguro administrado por Firebase y ofrece continuar a `/auth?tab=login` en el mismo origen del tenant. `handleCodeInApp: false` se mantiene: no es un enlace de login sin contraseña. El idioma del correo se toma del idioma activo de la app.

La aplicación también admite enlaces de restablecimiento dirigidos a `/auth?mode=resetPassword&oobCode=...`. Esa vista comprueba el código antes de pedir la contraseña, valida la política real del proyecto, exige repetirla y confirma el cambio mediante Firebase. Tras el éxito retira los parámetros del enlace de la URL, borra las contraseñas del estado y ofrece volver al login cerrando la sesión local anterior. Nunca inicia sesión automáticamente ni sincroniza/crea un perfil como consecuencia del reset.

La implementación vive en `frontend/src/lib/passwordRecovery.ts`, los adapters SDK en `firebaseConfig.tsx`, la composición en `AuthContext` y los formularios en `components/auth/`.

## Configuración y despliegue

1. Mantener las variables `VITE_FIREBASE_*` que ya utiliza el login y el proveedor email/contraseña habilitado en ese proyecto. La recuperación no toma `apiKey`, dominio de autenticación ni proyecto de los parámetros del enlace.
2. En Firebase Authentication, autorizar los dominios de los tenants y sus dominios personalizados usados como URL de continuación. También los hosts locales necesarios para desarrollo. Se conserva el origen completo, incluido esquema y puerto; no se sustituye `salon.localhost` por `localhost`.
3. Mantener habilitada la protección de enumeración de correos de Firebase y revisar sus cuotas. La respuesta neutral de la UI complementa esa protección.
4. Revisar remitente, nombre e idiomas de la plantilla de recuperación en Firebase. La aceptación de la solicitud por el proveedor no demuestra llegada a la bandeja de entrada.
5. Hacer una prueba con un buzón de prueba controlado: pedir correo, abrirlo, cambiar contraseña, volver al dominio original, comprobar login con la nueva y rechazo de la anterior, reutilizar el enlace y verificar expiración.

Este cambio no modifica las plantillas ni la URL de acción del proyecto Firebase. El circuito estándar funciona con su handler administrado. La vista propia solo se utiliza si el correo o la integración ya dirige la acción a `/auth`; no basta con configurar `continueUrl` para seleccionar esa vista.

No cambiar globalmente la URL de acciones de correo a `/auth` sin revisar los otros modos del proyecto (`verifyEmail`, `recoverEmail`, cambio de correo, etc.). Esta vista implementa exclusivamente `resetPassword`; los otros modos deben conservar su handler válido. En proyectos compartidos por varios tenants, tampoco se debe fijar como handler global el dominio de un negocio concreto.

Fuentes oficiales: [acciones de correo con handler propio](https://firebase.google.com/docs/auth/custom-email-handler), [SDK Web de autenticación](https://firebase.google.com/docs/reference/js/auth).

## Invariantes y errores

| Caso | Resultado |
| --- | --- |
| Correo vacío, mal formado o demasiado largo | Validación visible antes de consultar Firebase. |
| Correo existente, desconocido o cuenta deshabilitada | Misma confirmación condicional; nunca se afirma que la cuenta existe. |
| Proveedor Google/Microsoft | Ayuda para volver a usar el acceso habitual; no se consultan proveedores por correo. |
| Envío en curso o doble submit | Una operación por formulario; controles bloqueados durante la petición. |
| Solicitud aceptada | Confirmación persistente, revisión de spam y reenvío tras 60 segundos en ese formulario. Firebase aplica los límites efectivos entre pestañas, recargas y dispositivos. |
| Dominio de retorno no autorizado/configuración ausente | Error seguro de disponibilidad con siguiente paso; no se reenvía eliminando el retorno tenant. |
| Red, cuota o exceso de intentos | Mensaje específico y posibilidad de reintentar; se conserva el borrador. |
| Código ausente, inválido, caducado, usado o cuenta retirada | Estado no utilizable y acción para pedir otro enlace. |
| API key ajena, parámetros ambiguos o continuación de otro origen | Enlace rechazado; nunca seleccionan otro proyecto o destino. |
| Contraseñas distintas | Rechazo local sin consumir el código. |
| Contraseña insuficiente | Requisitos concretos del proyecto cuando están disponibles. Firebase valida de nuevo al confirmar. |
| Consumo concurrente/cambio de política entre comprobación y guardado | Se muestra el rechazo autoritativo de Firebase; no aparece éxito. |
| Se pierde la respuesta del guardado | No se declara éxito; se explica que el resultado es incierto y cómo reintentar o probar el login. |
| Cambio de tenant/local | Se desmontan los formularios y se borran sus borradores. Las respuestas tardías no actualizan el nuevo ámbito. |

Los códigos y contraseñas no se escriben en logs, almacenamiento persistente, mensajes ni trazas de la app. La política de Referer existente limita las referencias al origen. La validación del código no concede acceso a datos tenant; siguen vigentes las membresías y los guards habituales. La invalidación de sesiones remotas y los plazos de los ID tokens siguen la semántica Firebase existente; este cambio no modifica el backend de verificación ni promete expulsión inmediata de todos los dispositivos.

## Evidencia de aceptación UX/UI

Revisión del 18 de noviembre de 2026:

| Criterio | Evidencia y alcance |
| --- | --- |
| Tarea y esfuerzo | Recuperar acceso desde el mismo login sin buscar soporte; reutiliza el correo escrito y ofrece un siguiente paso para cada fallo contemplado. |
| Interacción elegida | Formulario convencional: correo, enlace y contraseña repetida. No se necesitan controles gráficos adicionales para decidir estos valores. |
| Contexto reutilizado | Origen e idioma actuales, email del login, política Firebase y branding efectivo. La persona decide el correo y la contraseña nueva. |
| Estados y consecuencias | Carga, validación, envío condicional, cooldown, error temporal/terminal, resultado incierto y éxito confirmado. Los errores conservan el borrador; el éxito borra las contraseñas. |
| Teclado y móvil | Tests de foco y nombres accesibles. Recorrido Chromium con activación por teclado de solicitud/envío, 1440x1000 oscuro y 390x844 claro/oscuro, movimiento reducido y comprobación de desbordamiento horizontal. |
| Componentes compartidos | `Button`, `Input`, `Label`, `Alert`, tokens existentes y estructura de branding de `/auth`. Las nuevas vistas se separan por responsabilidad. |
| Verificación | Tests de política/orquestación, contrato SDK y componentes/ruta. Recorrido del SDK real con respuestas HTTP Firebase simuladas; estados de solicitud, éxito, error de configuración, confirmación distinta, guardado, limpieza de URL y enlace caducado. |

Pruebas reproducibles desde `frontend/`:

```sh
npm run test:run -- src/lib/passwordRecovery.test.ts src/lib/firebaseConfig.passwordRecovery.test.ts src/components/auth/PasswordRecoveryFlow.test.tsx
npm run test:run
npm run lint
npm run build
npm run i18n:check
```

Resultado registrado: 63 tests nuevos de recuperación, 330 tests frontend totales, 49 tests de la matriz crítica backend, lint, build e i18n en verde. El typecheck adicional del frontend devuelve los mismos 14 errores que una copia limpia de `HEAD`, con salida idéntica; no introduce errores nuevos. Sus salidas comparadas están junto a las capturas locales como `typecheck-baseline.txt` y `typecheck-current.txt`.

Capturas locales de la revisión automatizada: `/private/tmp/managgio-password-recovery-qa/`, con estados `request`, `sent`, `error`, `reset`, `complete` y `expired` para las tres configuraciones de pantalla/tema. El script de esa revisión local está en `/private/tmp/managgio-password-recovery-browser.cjs` y requiere Chromium/Playwright del entorno de desarrollo; no forma parte del runtime del producto.

Pendiente antes de aceptar en producción: prueba de entrega real y retorno con los dominios autorizados del proyecto, revisión humana del flujo según `UX_UI.md`, lector de pantalla, zoom y teclado en pantalla. La cobertura automatizada y las capturas no certifican WCAG 2.2 AA ni todos los temas o configuraciones de los tenants. Responsable de esta aceptación: mantenimiento del proyecto, al preparar el despliegue.
