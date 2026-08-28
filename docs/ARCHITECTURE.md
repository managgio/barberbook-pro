# Arquitectura de Managgio

Managgio es una plataforma SaaS multi-tenant de gestión y reservas para barberías, salones y negocios equivalentes. Este documento ofrece el mapa del sistema; los detalles viven en documentos temáticos para evitar una guía monolítica.

## Mapa del repositorio

```text
app/
├── AGENTS.md                  # entrada y reglas de trabajo
├── docs/                      # arquitectura transversal y operación
├── backend/                   # NestJS, Prisma, MySQL
│   ├── src/contexts/          # bounded contexts DDD/hexagonales
│   ├── src/modules/           # delivery y puentes legacy en migración
│   ├── prisma/                # schema, migraciones y seed
│   ├── test/                  # unit, contract, parity y e2e
│   └── docs/adr/              # decisiones arquitectónicas
└── frontend/                  # React, Vite, React Query, Tailwind/shadcn
```

## Principios

- Multi-tenant estricto en HTTP, datos, permisos, cachés, jobs e integraciones.
- DDD pragmático y arquitectura hexagonal: dependencias apuntan al dominio.
- Casos de uso pequeños; adapters reemplazables; contratos explícitos mediante puertos.
- Fuente de verdad en backend. El frontend guía al usuario, pero no autoriza operaciones.
- Integridad bajo concurrencia: validación final, transacciones, locks e idempotencia donde corresponde.
- Rendimiento medido: consultas acotadas, índices alineados y carga frontend bajo presupuesto.
- Observabilidad segura: correlation ID y contexto tenant sin secretos ni PII innecesaria.
- Tests de regresión obligatorios para bugs y cobertura proporcionada al riesgo.

## Bounded contexts backend

| Contexto | Responsabilidad |
| --- | --- |
| `booking` | citas, disponibilidad, profesionales, horarios, cierres y festivos |
| `identity` | perfiles, membresías de marca, personal local y acceso |
| `commerce` | pagos, caja, suscripciones, productos y ofertas |
| `engagement` | notificaciones, comunicaciones, referidos, fidelización y reseñas |
| `platform` | resolución de tenant, contexto de request y operación de plataforma |
| `ai-orchestration` | asistente y herramientas con acceso mediado por puertos |

`src/modules` contiene delivery HTTP y código legacy que todavía actúa como puente. No es permiso para introducir nueva lógica de dominio en controllers o services monolíticos.

## Lectura por tema

- [Backend](architecture/BACKEND.md): capas, dependencias, CQRS y puertos.
- [Tenancy y seguridad](architecture/TENANCY_AND_SECURITY.md): resolución, autorización e invariantes de privacidad.
- [Frontend](architecture/FRONTEND.md): composición, estado, rutas, accesibilidad e i18n.
- [Booking y engagement](architecture/BOOKING_AND_ENGAGEMENT.md): disponibilidad, citas, festivos, comunicados y avisos.
- [Datos e integraciones](architecture/DATA_AND_INTEGRATIONS.md): Prisma, migraciones y proveedores externos.
- [Estándares de ingeniería](ENGINEERING_STANDARDS.md): calidad, rendimiento, tests y Definition of Done.
- [Legal y cumplimiento](LEGAL_COMPLIANCE.md).
- [ADR del backend](../backend/docs/adr/README.md).
- [Estrategia de testing backend](../backend/docs/testing/TESTING_STRATEGY.md).
- [Rendimiento](perf/PERF_BASELINE.md).

## Flujo de alto nivel

1. El middleware resuelve host/subdominio y fija `brandId`, `localId`, zona horaria y correlation ID en el contexto de request.
2. El controller valida el contrato de entrada y delega en un caso de uso/facade.
3. El caso de uso aplica políticas de dominio y consume puertos.
4. Los adapters ejecutan Prisma o proveedores externos con scope tenant.
5. El frontend invalida/refresca el estado servidor mediante React Query y eventos acotados.

Las reglas operativas para agentes están en [AGENTS.md](../AGENTS.md); este documento no debe crecer hasta convertirse de nuevo en un manual único.
