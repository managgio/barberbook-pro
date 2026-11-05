# Frontend

El frontend usa React 18, TypeScript, Vite, React Router, TanStack React Query, Tailwind y componentes shadcn/Radix.

## Responsabilidades

- `pages/`: composición de vistas y flujos.
- `components/`: UI reutilizable; extraer secciones cuando una página crece.
- `context/`: estado transversal de sesión, tenant, idioma y permisos.
- `data/api/`: contratos HTTP y acceso a backend.
- `data/types.ts`: modelos compartidos del cliente.
- `hooks/`: coordinación reutilizable.
- `lib/`: políticas puras y utilidades pequeñas.
- `i18n/locales/`: todo texto visible localizado.

## Estado y datos

- React Query es la fuente de verdad para estado servidor, con query keys que incluyan el local cuando corresponda.
- Context se reserva para sesión/configuración realmente transversal.
- Estado de formulario/UI permanece local.
- Después de mutaciones, invalida queries concretas o emite los eventos administrativos existentes; evita recargas globales.

## Autorización y rutas

La UI no concede permisos. `ProtectedRoute` mejora navegación, pero el backend sigue siendo autoritativo. Para decidir acceso admin del tenant usa `hasTenantAdminAccess(user)`. No uses `role === 'admin'` ni `isSuperAdmin` global como fallback.

Al cambiar de local se refresca el perfil tenant-scoped y se aíslan las queries. Un usuario admin de otro tenant debe navegar como cliente.

## Componentización

- Una página orquesta; los formularios complejos, paneles y diálogos viven en componentes/secciones dedicados.
- Las políticas calculables se extraen a funciones puras con tests.
- Evita efectos que duplican estado derivado y dependencias inestables.
- Mantén lazy loading en rutas pesadas y evita aumentar el chunk inicial.
- Las incidencias de notificaciones se componen en `components/notification-deliveries/`; la página tenant y Observabilidad de Platform reutilizan el mismo panel, tabla, tarjetas móviles y filtros por columna.

## UX, accesibilidad e i18n

El [estándar de UX/UI](UX_UI.md) es obligatorio para cualquier desarrollo nuevo o modificación de UI. Centraliza las reglas transversales de interacción, calidad visual, componentes, accesibilidad, estados y aceptación; las decisiones específicas de producto y marca se mantienen en este documento.

- Los grupos construidos con `TabsList` comparten un indicador deslizante accesible desde el componente base; no dupliques medición ni animación en cada página.
- No introduzcas texto visible inline si existe infraestructura i18n.
- Actualiza al menos `es.json` y `en.json`, y ejecuta `npm run i18n:check`.
- Consulta [FRONTEND_I18N_COPY_CHECKLIST.md](../FRONTEND_I18N_COPY_CHECKLIST.md).
- Las acciones de factura de calendario, clientes y búsqueda reutilizan un único componente. La generación PDF se carga de forma diferida y compartir usa Web Share con descarga como fallback. El generador recibe el modo de tema del tenant: en modo oscuro presenta el logo de la factura centrado sobre una base `#0a0a0a`, con esquinas redondeadas y margen interior, conservando sus proporciones. La decoración se aplica al descargar y compartir, también a facturas existentes, sin modificar su instantánea fiscal ni sustituir el logo guardado.
- La configuración fiscal del tenant solo se monta si Platform habilitó facturación. El selector de varios servicios sigue la misma jerarquía: capacidad de Platform y preferencia del tenant antes de cambiar el flujo público.
- Platform habilita las FAQ mediante `features.faqEnabled`, desactivado por defecto y autoritativo a nivel de marca. La pestaña vive en Página Web y aparece cuando su capacidad y sección están habilitadas. Su editor se carga de forma diferida, conserva el idioma fuente y reutiliza la traducción manual/IA por campo. El contenido y las cachés se separan por local; la lectura pública también se separa por idioma. Las preguntas se ordenan mediante asa táctil, ratón o flechas de teclado, con guardado atómico, bloqueo de acciones durante la escritura y recuperación de la lista ante conflictos. La landing omite el acordeón si la capacidad está desactivada, el admin no la publica, la sección está oculta o no hay preguntas.
- La selección de pestañas de marcas en Platform conserva el par `background`/`foreground` (fondo negro y texto claro en Platform). El indicador compartido queda en una capa negativa dentro del contenedor aislado para mantener las etiquetas por encima de la superficie animada.
- Los accesos directos de Managgio usan iconos específicos, separados del logo social: PNG opacos sobre `#0A0A0B`, con el rayo original centrado al 68 % del lienzo. `index.html` declara el icono de navegador de 192 px y `apple-touch-icon` de 180 px antes del bootstrap; `TenantContext` conserva esas referencias versionadas para Platform y el fallback de Managgio. El favicon ICO incluye 32, 48 y 256 px con el mismo diseño. Los logos configurados de los tenants conservan su identidad y eliminan los tamaños del fallback al sustituirlo. Las esquinas las aplica el sistema operativo, no el archivo.
- La reserva de invitado ofrece recordatorios solo a partir de `notificationCapabilities` efectivas del bootstrap. Un único canal se presenta como consentimiento simple y varios como selección combinable; no existe alta implícita y cualquier selección exige teléfono. La prueba manual de SMS vive únicamente en Platform, se renderiza solo para administradores de plataforma en desarrollo local, usa el remitente global `MANAGGIO` y bloquea mensajes de más de tres segmentos tras calcular GSM-7 o UCS-2.
- El enlace firmado de una cita invitada abre la ruta pública lazy `/cita/:token`. La vista consume únicamente el resumen mínimo del backend, no muestra PII, trata token inválido y expirado como un mismo estado y solo ofrece cancelación cuando `canCancel` es verdadero, siempre con confirmación.
- La política global de `Referer` usa `origin`: permite al backend contrastar el tenant enviado por el cliente con el dominio público, pero nunca expone rutas ni tokens de enlaces de cita a recursos externos.
- Calendario, búsqueda, clientes y edición reutilizan la presentación de citas de `appointmentPresentation` y `AppointmentServiceSummary`: una cita múltiple se identifica como un único bloque, pero conserva desglose, orden, duración e importes por servicio. `Appointment.price` siempre se rotula como total de la cita para no confundirlo con el precio de una línea.
- La vista Platform del asistente IA es una ruta lazy y paginada. Sus filtros de periodo, origen y tenant se resuelven en servidor; el detalle diferencia visualmente texto, voz y plantilla sin descargar el historial completo en el listado.

## Rendimiento

- Conserva los budgets y mediciones de [PERF_BASELINE.md](../perf/PERF_BASELINE.md).
- Pagina listas, virtualiza cuando el volumen lo justifique y evita peticiones por elemento.
- Los historiales operativos filtran y paginan en servidor. Las opciones ligeras de tenant/local se cargan por un endpoint específico, sin reutilizar respuestas de configuración completas.
- Optimiza imágenes y no añadas dependencias grandes para una utilidad pequeña.

## Tipografía y color secundario de la landing

Platform > Marcas > Config incluye `BrandLandingAppearanceEditor`, con vista previa aislada, color secundario opcional y subida de una fuente de títulos TTF, OTF, WOFF o WOFF2 (máximo 2 MB). La selección forma parte del borrador de configuración: se publica al guardar y puede restablecerse por separado. El selector valida extensión, tamaño, firma y decodificación con `FontFace` antes de subir. Durante la subida se bloquea el guardado; cambiar de marca aborta el envío e ignora resultados tardíos.

`theme.secondary` y `theme.headingFont` se heredan de marca a local en el bootstrap. Su ausencia conserva exactamente los estilos anteriores; `null` expresa una retirada explícita. Solo `LandingAppearance` aplica estas opciones, mediante variables CSS locales. La vista previa usa el mismo componente con tokens independientes y reutiliza `LandingSectionAccent`, `Card` y el botón `hero` de la landing, incluyendo el contorno secundario sin una variante visual separada. Cambiar o quitar el secundario actualiza la muestra inmediatamente; nunca cambia el tema de Platform, el admin o autenticación.

Las clases `landing-heading` identifican títulos y cifras destacadas; párrafos, navegación, botones, filtros y respuestas conservan su tipografía. `useLandingFont` utiliza la CSS Font Loading API, mantiene la fuente habitual mientras carga o si falla, y retira las caras registradas al desmontar o cambiar de archivo. Las URLs versionadas de ImageKit permiten reutilizar la caché del navegador. WOFF2 es recomendable para reducir la transferencia; no se convierte el archivo automáticamente.

El secundario acompaña al primario dentro de cada elemento. La raya larga de sección, las etiquetas y los brillos conservan el primario; solo el punto corto usa el secundario. Los botones primarios incorporan un contorno interior secundario de 1 px, conservando relleno, dimensiones, sombras y foco de teclado. El filtro activo de galería combina fondo primario y borde secundario. Los marcos mantienen su línea primaria junto al borde complementario; las tarjetas conservan sus bordes y combinan una base primaria tenue con un matiz secundario en una esquina. El tono de los pequeños detalles se adapta al fondo del tema para que siga siendo visible. Todas estas reglas exigen un secundario válido; al quitarlo desaparece el contorno añadido y se recuperan exactamente los estilos previos.

## Verificación mínima

- Tests Vitest de las políticas/componentes cambiados.
- `npm run test:run`
- `npm run lint`
- `npm run build`
- `npm run i18n:check` cuando aplique.

## Agenda y horarios del tenant

Configuración > Agenda y horarios se compone en `components/admin/settings/AgendaSettings.tsx`. Presenta la semana en filas compactas y despliega la edición de un día junto a sus horas; los días cerrados conservan sus turnos en el borrador para poder reabrirlos. Los minutos entre citas ofrecen presets y entrada exacta. Descansos y márgenes al cierre se despliegan bajo demanda, con un resumen de los valores y excepciones activos. Los títulos de Tiempo entre citas, Descansos de la agenda y Cierre y excepciones incluyen una ayuda de información con una explicación breve y un ejemplo, accesible por clic, teclado y táctil; abrir la ayuda no despliega ni modifica la sección. En móvil las secciones se apilan; los campos de hora conservan etiquetas, entrada exacta y navegación por teclado. La composición reutiliza `Card`, `Button`, `Input`, `Label`, `Switch`, `Collapsible`, `Select`, `Checkbox`, `Popover` y `AlertDialog`, con los tokens efectivos del tenant.

Copiar horario o descansos permite elegir los días de destino y exige confirmar el alcance antes de modificar el borrador. La copia sustituye únicamente los valores semanales de esos días, excluye el origen y conserva las fechas concretas y las aperturas extraordinarias. Copiar descansos repetidamente no los acumula ni duplica los del día de origen. Las eliminaciones muestran su impacto y requieren confirmación. Un margen específico de `0` sigue siendo una excepción explícita; quitarlo recupera la herencia de fecha, día o valor general que corresponda.

El borrador se limita al local actual y se conserva al cambiar de pestaña, al refrescar consultas y ante un error de guardado. Descartar recupera la última versión leída del servidor. Cambiar de local reinicia el editor y las respuestas tardías de otro local no actualizan sus datos ni emiten eventos en el nuevo ámbito. Guardar cambios se sitúa en la cabecera, junto a las pestañas, en la misma posición que en Identidad y landing y Operativa. El editor conserva la validación y el estado del guardado aunque sus acciones se presenten en la cabecera. El guardado muestra estado pendiente, en curso, éxito o error; bloquea los controles durante la escritura y valida horas, intervalos y minutos antes de enviar. Se mantiene una única escritura de `ShopSchedule` con el horario y las reglas; la sincronización de `SiteSettings.openingHours` sigue siendo responsabilidad del backend. La explicación del horario público y su relación con los profesionales se conserva.

El botón de cabecera guarda únicamente la pestaña visible. Identidad y landing guarda sus datos públicos; Operativa guarda las preferencias de reserva, perfil y productos, incluidos los interruptores de productos, que permanecen en el borrador hasta guardar. La selección de campos vive en `lib/settingsSections.ts`: el contrato de configuración completa se compone desde la base confirmada y los campos de la pestaña elegida. Los borradores de las demás pestañas no se envían ni se publican en caché. La respuesta del servidor actualiza la base y conserva los cambios todavía pendientes, incluso los introducidos durante el guardado. Agenda mantiene su única escritura de horario y reglas.

Las regresiones de composición, teclado, copia confirmada, valores heredados, errores, refrescos y cambio de local están en `AgendaSettings.test.tsx`, `AdminSettings.agenda.test.tsx` y `lib/scheduleSettings.test.ts`. Esta cobertura no certifica por sí sola conformidad WCAG ni sustituye la revisión visual del flujo.

## Galería y publicación de la landing

La pestaña de galería en Página Web aparece únicamente con `features.galleryEnabled === true` y la sección habilitada; revocar la capacidad abandona una pestaña recordada de forma segura. Su editor se carga con lazy loading y se reinicia al cambiar de local. Categorías, trabajos, traducciones y cachés usan el local actual. Los títulos y descripciones se editan en idioma fuente; `InlineTranslationPopover` mantiene el flujo manual/IA por campo. Las categorías permiten alta, renombrado y eliminación solo si están vacías.

El editor muestra las imágenes utilizadas y el límite independiente de 12 para el local actual según `imageUsage` del backend. Al agotarlo bloquea nuevos trabajos, permite sustituir fotos y eliminar contenido. Una comparación antes/después consume dos plazas; con una sola plaza libre se permite guardar solo el resultado. La validación previa a la subida usa el cupo disponible y descuenta las fotos del trabajo editado. Las mutaciones invalidan únicamente la galería y las traducciones del local actual; los cupos de otros locales no cambian. El servidor vuelve a comprobar el cupo dentro de la transacción; ante un rechazo se conserva el borrador y se refresca el contador.

FAQ y galería tienen un control independiente de publicación, con estado confirmado por el servidor, versión optimista y recuperación ante error. La galería empieza oculta; las FAQ conservan la publicación anterior. Ocultar mediante este control no elimina contenido ni impide editarlo. Si Platform deshabilita la sección, desaparece su pestaña de Página Web.

## Página Web e imágenes

`/admin/website` agrupa Imágenes, Galería y Preguntas frecuentes. La opción `website` del sidebar está desactivada por defecto y se habilita desde Platform > Marcas > Sidebar. Exige el permiso administrativo `website`. Configuración deja de montar los editores de FAQ y galería. El navbar solo existe si hay más de una opción disponible; la selección se corrige al revocar una capacidad y se reinicia al cambiar de local.

El editor presenta las fotos efectivas del local por sección: portada con hasta cinco fotos, fondo de cabecera, bloques de presentación activos e imagen final si está habilitada. Las tarjetas incluyen foto, posición y explicación; una sola foto de portada queda fija y varias rotan cada seis segundos. Elegir, sustituir, ordenar y quitar fotos modifica un borrador; Guardar y publicar optimiza, sube y persiste. Cancelar nunca elimina una imagen publicada. La cuadrícula de fotos se ordena con un asa táctil o de ratón, una vista flotante de la foto y un hueco de destino; las demás tarjetas se desplazan y el diálogo hace autoscroll en sus bordes. El teclado usa espacio para coger/soltar y flechas para elegir posición. Escape, pérdida del puntero, cambio de tamaño o soltar fuera cancelan el gesto. Con una sola foto no se muestra el asa. El orden permanece en el borrador hasta guardar.

Platform y el admin consumen las mismas `BrandConfig` y `LocationConfig`. El admin modifica únicamente las imágenes del local; los demás campos siguen heredando la marca. Con un único local, Platform muestra un solo panel de landing con la configuración efectiva, sin selector ni panel separado de marca/local. La cabecera sigue el patrón de las pestañas de Platform: icono en color primario y texto secundario sobre el contenido, sin un título adicional «Página web» dentro del panel. Los controles se agrupan en acordeones: secciones y orden, cabecera, imágenes y presentación. Las fotos se leen y guardan en el local, manteniendo los campos heredados de marca; los cambios de orden, visibilidad y cabecera se aplican también al override local para evitar configuraciones ocultas que anulen el control único. Con varios locales se mantienen los paneles Por marca y Por local: cada uno edita su ámbito, y seleccionar el local a configurar nunca cambia el local por defecto del tenant. Las imágenes locales se pueden editar directamente. Mientras carga otro local se oculta su contenido anterior, y los cambios pendientes bloquean el selector hasta guardar. Los datos se refrescan al recuperar el foco y cada 15 segundos; las capacidades del admin se actualizan cada 30 segundos. Los borradores abiertos conservan su revisión y no se sobrescriben con el refresco. Un conflicto 409 pide volver a cargar la última versión. Cambiar de local desmonta el editor y todas las peticiones de imagen capturan el local original.

En Platform, FAQ y galería tienen un único interruptor por sección en el panel único o en «Por marca». Al activarlo se habilita la capacidad y se quita la sección de `hiddenSections`; al apagarlo se revoca la capacidad y se oculta la sección. Ambos valores se actualizan en el mismo borrador y se persisten con «Guardar cambios». El contenido y la publicación decidida por el admin se conservan. Los overrides locales solo controlan visibilidad, nunca habilitan ni revocan capacidades de marca: permanecen bloqueados con una explicación visible hasta que se habilita el módulo.

La galería pública utiliza una cuadrícula de dos columnas en móvil y tres en escritorio, con miniaturas 4:5 y vista ampliada sin recorte. Los filtros muestran categorías con contenido. Se renderizan 12 trabajos inicialmente y se amplían de 12 en 12, con imágenes lazy, `srcset`, `sizes` y dimensiones explícitas. El comparador tiene un único control sobre la imagen: permite arrastrar con ratón o dedo y su asa accesible admite flechas, Inicio/Fin y RePág/AvPág sin cambiar de trabajo. La vista ampliada conserva foco, cierre y navegación accesibles. El encabezado «Nuestro trabajo» y el acento decorativo compartido heredan el color `primary` del tenant, al igual que los filtros activos.

La ordenación de FAQ y galería comparte `useOrderedListDrag`: asa de arrastre con captura de puntero, tarjeta que sigue el gesto, desplazamiento animado de las demás filas y autoscroll del contenedor. Admite cancelación con Escape o interrupción del puntero, soporte táctil y alternativa con flechas de teclado; las FAQ muestran Editar/Eliminar a la derecha. El guardado optimista de orden se revierte y consulta de nuevo ante fallo. Los formularios conservan el borrador ante errores o conflictos y no reintentan escrituras automáticamente.

Página Web utiliza el ancho disponible y la cabecera estándar del admin. El selector compartido `PhotoSourcePicker` ofrece biblioteca y cámara por separado: la biblioteca conserva selección múltiple cuando corresponde y la cámara solicita `capture="environment"` con una sola foto. El navegador/dispositivo decide cómo abrirla; no se solicita acceso a la cámara al cargar la página. Ambos flujos pasan por la misma optimización. Cada sección muestra orientación, proporción y resolución orientativas antes y durante la edición. La presentación pública usa marcos uniformes 4:3 acotados a 480 px de ancho y detalles del token `primary`, compartidos con productos, profesionales y FAQ. Las tarjetas de profesionales incorporan un borde tenue y una línea bajo la fotografía con ese mismo color del tenant, también visibles en móvil.
