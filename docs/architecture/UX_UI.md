# UX/UI - diseño operativo de interacción directa

## Alcance y obligatoriedad

Este documento es la fuente canónica de las normas transversales de UX/UI de Managgio. Su cumplimiento es obligatorio para cualquier desarrollo nuevo o modificación de UI, incluidos componentes compartidos y superficies públicas, de cliente, de administración y de Platform. El criterio de aceptación se aplica al flujo y a los estados afectados por el cambio.

La adopción de esta norma no acredita que las pantallas actuales la cumplan ni constituye una auditoría de accesibilidad. Tampoco exige rediseños ajenos al alcance de una tarea. Los incumplimientos preexistentes detectados fuera de ese alcance deben registrarse como pendientes, sin declararlos resueltos. Las excepciones siguen la política de [Estándares de ingeniería](../ENGINEERING_STANDARDS.md).

## Decisiones existentes y fuentes de verdad

- La composición, el estado, las rutas, la autorización y la localización siguen [Frontend](FRONTEND.md). Conservar contexto no permite trasladar borradores, selecciones o datos entre tenants ni mantener acceso tras revocar permisos.
- La identidad de Managgio y de cada tenant, los logos y las reglas particulares de la landing se mantienen según las decisiones documentadas en [Frontend](FRONTEND.md#ux-accesibilidad-e-i18n) y [Tipografía y color secundario de la landing](FRONTEND.md#tipografía-y-color-secundario-de-la-landing). Este estándar no redefine la marca ni amplía el ámbito de sus opciones de apariencia.
- Las fuentes de implementación son los tokens de [index.css](../../frontend/src/index.css), su integración en [Tailwind](../../frontend/tailwind.config.ts), la aplicación del tema en [theme.ts](../../frontend/src/lib/theme.ts) y los [componentes compartidos](../../frontend/src/components/ui/). Se reutilizan sin copiar aquí sus valores ni crear un tema paralelo.
- Los contratos y las reglas de negocio conservan su capa propietaria, según [Arquitectura](../ARCHITECTURE.md). Las previsualizaciones y los controles del cliente no sustituyen la validación ni la autorización del backend.

## Estándar adoptado

La interfaz debe partir de la tarea real, las decisiones frecuentes y el contexto disponible. Su calidad se evalúa por cuánto facilita comprender, decidir y actuar.

Siempre que reduzcan de forma real clics, tiempo, errores o carga mental, se deben preferir controles manipulables y con respuesta inmediata: presets, selectores visuales, sliders, calendarios, timelines, drag and drop, steppers, edición directa y previsualizaciones.

La solución más sencilla que resuelva mejor la tarea prevalece. Un control convencional es válido cuando aporta mayor claridad o precisión. Cada interacción gráfica debe tener una utilidad concreta y verificable en el criterio de aceptación; añadirla por apariencia no satisface la norma.

### 1. Diseñar alrededor de decisiones reales

- Antes de añadir campos, pasos o páginas, identificar qué necesita decidir la persona y con qué información cuenta. La descripción del cambio debe nombrar esa tarea.
- No trasladar automáticamente cada propiedad del modelo de datos a un campo. Pedir solo lo necesario para resolver la tarea y permitir las decisiones pertinentes.
- Mantener las acciones junto al contenido sobre el que actúan y hacer inequívoco qué elemento o selección modifican.
- Conservar selección, filtros, posición y datos introducidos al consultar, editar, guardar, cancelar o volver. Cancelar descarta únicamente la edición correspondiente y recupera el contexto anterior, dentro del ámbito autorizado.
- Evitar confirmaciones, navegación y trabajo repetido que no aporten seguridad o comprensión. Se conserva la regla existente: toda acción destructiva o masiva debe mostrar su impacto y requerir confirmación. No añadir confirmaciones duplicadas para el mismo efecto.

### 2. Aprovechar el contexto

- Derivar los datos que el sistema pueda conocer con fiabilidad en lugar de pedirlos de nuevo. Identificar su fuente y no presentar una inferencia incierta como un dato confirmado.
- Ofrecer valores iniciales seguros y editables cuando exista una decisión real. Un valor inicial debe resultar visible antes de aplicar sus consecuencias.
- Facilitar copiar, reutilizar, duplicar o aplicar cambios en bloque cuando evite tareas repetitivas. Hacer visible el alcance y las diferencias que la persona deba revisar.
- Mostrar acciones y ayudas cuando sean pertinentes y estén disponibles. Explicar los bloqueos que afecten a la tarea, sin ofrecer operaciones que el sistema no pueda ejecutar.
- Mantener explícitas las condiciones, consecuencias y limitaciones relevantes antes de actuar: por ejemplo, el local afectado, un cupo o un cambio que se vaya a publicar.

### 3. Mostrar resultados y consecuencias

- Toda interacción debe proporcionar feedback comprensible: qué ha cambiado, qué se está procesando o qué impide continuar. Los estados relevantes deben poder percibirse también con tecnologías de asistencia.
- Mantener visible el valor exacto configurado, con su unidad y límites cuando correspondan, incluso al usar un control gráfico. Si se necesita precisión, permitir introducir o ajustar ese valor con un mecanismo equivalente.
- Incorporar una previsualización cuando ayude a comprender el resultado antes de confirmar. Debe representar el borrador actual y distinguirse del resultado ya persistido o publicado.
- Diferenciar cambios pendientes, guardado en curso, éxito y error. Mostrar éxito solo tras la confirmación de la capa responsable; una actualización optimista debe poder recuperarse ante un rechazo.
- Preservar los datos introducidos cuando falle una operación. Explicar cómo corregir o reintentar sin obligar a reconstruir el trabajo ni ocultar un conflicto.

### 4. Aplicar divulgación progresiva

- Resolver el camino habitual con pocas decisiones claras y mostrar las opciones avanzadas cuando se necesiten.
- Conservar toda la capacidad de configuración: una opción avanzada debe ser localizable y sus valores activos no deben quedar ocultos de forma engañosa.
- Elegir edición contextual para ajustes locales, modales o paneles para tareas acotadas y páginas completas cuando la profundidad o el espacio de trabajo lo requieran. La elección debe justificarse por la tarea.
- Mantener los flujos continuos en una superficie que permita trabajar sin perder contexto. Evitar encadenar diálogos o páginas para decisiones que se pueden resolver juntas con claridad.

### 5. Mantener una calidad visual coherente

- Respetar la identidad visual, los tokens y el ámbito de personalización existentes. Utilizar los pares de superficie y texto del tema en los estados normal, activo, foco y deshabilitado.
- Usar jerarquía, contraste, alineación y espacio para comunicar importancia y agrupar decisiones relacionadas.
- Mantener una interfaz compacta y legible, con controles cómodos. Reducir espacio no debe dificultar leer etiquetas, introducir datos o pulsar acciones.
- Dosificar el color de acento y reservarlo para decisiones, estados y acciones relevantes, siguiendo los patrones de marca vigentes.
- Utilizar bordes discretos, sombras contenidas y radios consistentes con los componentes y tokens compartidos.
- Evitar saturación visual, decoración gratuita y animaciones perpetuas. Cada transición debe explicar un cambio de estado, orientar o proporcionar feedback, y respetar movimiento reducido.

### 6. Reutilizar el sistema de componentes

- Reutilizar los patrones compartidos de botones, formularios, tablas, pestañas, calendarios, modales y avisos. Revisar tanto `components/ui/` como los componentes del flujo antes de crear otro.
- Evitar variantes locales que alteren arbitrariamente dimensiones, tipografía, estados o comportamiento. Una necesidad nueva debe justificar la diferencia y conservar las garantías del componente base.
- Incorporar una solución al sistema compartido cuando el patrón se repita y exista una necesidad demostrada. Mantener una única implementación del comportamiento común.
- Evitar abstracciones y dependencias añadidas únicamente por apariencia. La elección debe considerar el coste de mantenimiento y de carga.

### 7. Garantizar accesibilidad y adaptación

- Cumplir WCAG 2.2 AA en los flujos principales. La revisión debe cubrir el proceso completo afectado, incluidos errores y confirmaciones, sin inferir conformidad a partir de una captura o un test aislado.
- Conservar semántica, etiquetas y nombres accesibles, navegación por teclado y foco visible. El orden debe seguir la tarea; abrir y cerrar superficies debe situar y devolver el foco de forma previsible, sin trampas de teclado.
- Ofrecer alternativas equivalentes a gestos, arrastre y representaciones gráficas. Un cambio de orden debe poder realizarse sin arrastrar, tanto con teclado como con pulsaciones o clics simples; una representación gráfica debe permitir conocer los datos necesarios para decidir.
- Acompañar el color con texto, iconos u otras señales comprensibles. Un estado o una selección no puede depender solo del tono.
- Respetar `prefers-reduced-motion`: eliminar o reducir el movimiento prescindible sin perder la información del cambio de estado.
- Adaptar la composición a móvil sin desbordar la página ni comprimir los controles hasta dificultar su uso. Comprobar textos largos, zoom, teclado en pantalla y contenido real; los elementos que necesiten desplazamiento propio deben mantener accesibles sus acciones y etiquetas.

### 8. Cubrir estados y rendimiento

- Diseñar explícitamente carga, vacío, error, éxito, ausencia de permisos y disponibilidad. Diferenciar no tener datos, no tener acceso y tener una función deshabilitada o un recurso no disponible; indicar el siguiente paso cuando exista.
- Evitar botones ficticios, métricas inventadas y promesas no respaldadas. Los datos mostrados deben proceder de una fuente real y las acciones deben tener un resultado implementado.
- Cargar los elementos pesados cuando se necesiten y mantener acotadas las colecciones, siguiendo [Rendimiento frontend](FRONTEND.md#rendimiento) y los presupuestos existentes.
- Conservar la autoridad de validación y permisos en la capa responsable. Los valores derivados, presets, operaciones en bloque y previsualizaciones deben pasar por los mismos contratos que el resto del flujo.
- No sacrificar rendimiento, mantenibilidad o precisión por una interacción más vistosa. Si no se puede mantener respuesta inmediata durante una operación, comunicar su progreso sin bloquear innecesariamente el resto de la tarea.

## Criterio de aceptación

Toda modificación de UI debe responder a los siete puntos siguientes en la descripción del cambio o de la PR, con evidencias referenciables. Si un punto no aplica, se debe justificar con relación al alcance; dejarlo vacío no demuestra cumplimiento.

| Punto | Evidencia exigida |
| --- | --- |
| 1. Qué tarea facilita y qué esfuerzo reduce | Tarea y persona usuaria, recorrido habitual y reducción concreta de pasos, tiempo, errores o carga mental. Describir la diferencia observable sin inventar métricas. |
| 2. Por qué se ha elegido esa interacción | Relación entre el control y la decisión real. Justificar la utilidad de la manipulación directa o la claridad y precisión de un control convencional. |
| 3. Qué información deriva o reutiliza | Fuentes fiables, valores iniciales editables y reutilización o acciones en bloque que evitan introducir datos de nuevo; señalar qué debe seguir decidiendo la persona. |
| 4. Cómo comunica valores, consecuencias y estados | Valores y unidades visibles, alcance, previsualización cuando ayude, confirmaciones necesarias y comportamiento ante carga, vacío, permisos, disponibilidad, guardado, éxito y error. Indicar cómo se conserva el borrador. |
| 5. Cómo funciona con teclado y en móvil | Recorrido de teclado, foco, alternativa equivalente a gestos o gráficos y comprobación móvil con las condiciones de reproducción. Incluir las verificaciones de accesibilidad del flujo. |
| 6. Qué componentes compartidos utiliza | Componentes y patrones reutilizados, tokens aplicados y motivo de cualquier extensión necesaria. |
| 7. Cómo se ha verificado su comportamiento y apariencia | Tests y comandos ejecutados con resultado, más evidencia de revisión humana del flujo y capturas o grabaciones de las vistas y estados afectados. Identificar tamaños de pantalla y temas revisados, límites y pendientes. |

Esta evidencia forma parte del [Definition of Done](../ENGINEERING_STANDARDS.md#definition-of-done). Los tests deben cubrir comportamiento y regresiones conforme a la política existente; las capturas complementan la verificación funcional.

## Controles automáticos existentes y sus límites

Los comandos siguientes existen en [frontend/package.json](../../frontend/package.json) y se ejecutan desde `frontend/`. Esta tabla describe su alcance real; adoptar el estándar no añade nuevos controles ni amplía su cobertura.

| Control existente | Qué comprueba | Qué no acredita |
| --- | --- | --- |
| `npm run test:run` | Vitest con jsdom y Testing Library: las políticas y los comportamientos expresamente cubiertos por los tests. Por ejemplo, [GallerySection.test.tsx](../../frontend/src/components/landing/GallerySection.test.tsx) comprueba teclado y valores del comparador. | Cobertura de todos los flujos, layout real, contraste, interacción táctil o conformidad WCAG completa. |
| `npm run lint` | Las reglas configuradas de ESLint, TypeScript y React Hooks en [eslint.config.js](../../frontend/eslint.config.js). | La configuración actual no incluye un conjunto específico de reglas de accesibilidad ni evalúa calidad visual o utilidad de una interacción. |
| `npm run build` | Compilación y empaquetado de producción con Vite. | Comportamiento funcional, apariencia final o accesibilidad. |
| `npm run i18n:check` | [Cobertura de claves estáticas detectadas y coincidencia de placeholders](../../frontend/scripts/i18n-key-coverage.mjs) entre `es.json` y `en.json`. | Calidad de traducción, ausencia de todo texto inline, claves dinámicas, legibilidad o adaptación visual. |
| `npm run perf:baseline` | Build con sourcemaps, informe y validación de los [presupuestos de bundle e imágenes](../../frontend/perf-budgets.json). | Latencia de interacción, rendimiento de todos los dispositivos o experiencia completa del usuario. |

El workflow [Frontend Perf Budget](../../.github/workflows/frontend-perf-budget.yml) ejecuta `perf:baseline` en PR y en push a `main` para los cambios de rutas que declara. La existencia de los otros scripts no significa que los ejecute ese workflow.

No hay un gate configurado de conformidad WCAG 2.2 AA ni de comparación visual de capturas. Los tests parciales de semántica, foco o movimiento reducido no equivalen a una auditoría. Aprobar lint, tests, build, i18n o presupuestos no basta para declarar cumplido este estándar.

## Revisión humana obligatoria

Antes de dar por terminado un cambio de UI se debe recorrer el flujo afectado y registrar el resultado en la evidencia de aceptación:

- Comprobar con una tarea y datos representativos si se comprende qué decidir, si la interacción reduce el esfuerzo descrito y si consultar, editar, guardar, cancelar y volver conservan el contexto previsto.
- Provocar los estados pertinentes, incluidos rechazo del servidor, falta de permisos y recuperación ante error; verificar que no se pierde el trabajo ni se presenta como guardado un resultado no confirmado.
- Completar el recorrido solo con teclado, revisar foco y nombres o anuncios con tecnología de asistencia cuando corresponda, y probar las alternativas sin arrastre. Comprobar también movimiento reducido.
- Inspeccionar en navegador escritorio y móvil, con los temas y configuraciones de marca afectados: jerarquía, contraste, valores exactos, controles, textos largos, zoom, desbordamientos y comportamiento táctil. Registrar tamaños, estados y capturas o grabaciones que permitan reproducir la revisión.
- Distinguir lo verificado de lo pendiente. La evidencia debe describir el resultado observado y sus límites, sin extenderlo a pantallas o configuraciones no revisadas.
