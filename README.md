# Barberbook Pro Monorepo

Este repositorio contiene el código de **Barberbook Pro**, organizado como un **monorepo** que agrupa frontend (y en el futuro, backend).

## Estructura del proyecto

```text
.
├─ frontend/   # Aplicación web (Vite + React + TypeScript + Tailwind + shadcn-ui)
└─ backend/    # API NestJS + Prisma + MySQL
```

## Frontend

El frontend vive en `frontend/` y está construido con:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Desarrollo local (solo frontend)

```sh
# Clonar el repositorio
git clone https://github.com/managgio/barberbook-pro.git
cd barberbook-pro

# Ir a la carpeta del frontend
cd frontend

# Instalar dependencias
npm install  # o pnpm/yarn, según uses

# Levantar el entorno de desarrollo
npm run dev
```

### Configuración de ImageKit (subida de fotos)

- Copia `frontend/.env.example` a `frontend/.env.local` y rellena:
  - `VITE_API_BASE_URL` (URL del backend, por defecto `http://localhost:3000/api`)
- El backend expone `/api/imagekit/sign` para firmar subidas; las credenciales viven en el backend.

## Backend (NestJS + Prisma + MySQL)

El backend vive en `backend/` con NestJS y Prisma sobre MySQL.

### Puesta en marcha

```sh
cd backend
cp .env.example .env   # ajusta DATABASE_URL, claves de ImageKit y puerto
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed     # datos de ejemplo que sustituyen los mocks del frontend
npm run start:dev
```

### Base de datos local con Docker (MySQL)

En desarrollo puedes levantar MySQL con Docker desde la raiz del repo.

```sh
docker compose up -d
```

La configuracion por defecto coincide con `backend/.env`:

- `DATABASE_URL="mysql://prisma:password@127.0.0.1:3306/leblond"`

Para parar el contenedor:

```sh
docker compose down
```

#### Backup y restore

Scripts sencillos en `scripts/` para exportar o importar datos:

```sh
# Crear dump
./scripts/db_dump.sh ./db_dump.sql

# Restaurar dump
./scripts/db_restore.sh ./db_dump.sql
```

### Dependencias principales

- NestJS (REST API con validación y CORS)
- Prisma ORM (MySQL) con seed inicial (usuarios, barberos, servicios, citas, festivos y horarios)
- ImageKit (firma de subidas desde `/api/imagekit/sign`)
- Superadmin configurable por email (env `SUPER_ADMIN_EMAIL` en backend)
- Notificaciones: correo al crear/editar citas y recordatorios multicanal mediante gateways desacoplados

### Variables de entorno clave (backend)

- `DATABASE_URL` (MySQL)
- `SUPER_ADMIN_EMAIL`
- ImageKit: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
- SMS global `MANAGGIO`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` y `SMS_STATUS_CALLBACK_URL` (se mantienen `TWILIO_AUTH_SID` y `TWILIO_ACCOUNT_TOKEN` como alias legacy). El Sender Pool del Messaging Service debe contener el emisor alfanumérico `MANAGGIO`; el adapter lo fuerza en `From` y falla sin reintentar si no está asociado
- Presupuesto global de mensajería: `MESSAGING_DAILY_BUDGET_USD` (`TWILIO_DAILY_BUDGET_USD` se conserva solo como fallback legacy)
- Enlaces de gestión para invitados: `GUEST_APPOINTMENT_LINK_SECRET` global de al menos 32 bytes
- Runtime: `NODE_ENV=production` es obligatorio para activar SMS rutinarios; fuera de producción quedan bloqueados. La prueba manual solo se expone a Platform desde localhost, aplica cooldown y debe confirmar que el proveedor devuelve `MANAGGIO` como remitente real
- Email (avisos): `EMAIL`, `PASSWORD` y opcional `EMAIL_HOST` (default `smtp.gmail.com`), `EMAIL_PORT` (default `587`)
- Asistente IA: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_TEMPERATURE`

### Asistente IA (Admin)

- Endpoint: `POST /api/admin/ai-assistant/chat`
- Capacidades y tools actuales: `backend/src/modules/ai-assistant/AI_ASSISTANT_CAPABILITIES.md`

## Uso de Git en el monorepo

Todo el control de versiones se hace desde la **raíz del proyecto**:

```sh
# Ver el estado del repo (frontend + backend)
git status

# Añadir cambios
git add .

# Crear commit
git commit -m "feat: descripción del cambio"

# Subir cambios a GitHub
git push origin main
```

## Despliegue

De momento, el despliegue aplica solo al frontend (por ejemplo, Vercel u otra plataforma). Cuando se añada el backend se documentará aquí el flujo de despliegue completo.
