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
  - `VITE_IMAGEKIT_PUBLIC_KEY`
  - `VITE_IMAGEKIT_URL_ENDPOINT`
- El backend expone `/api/imagekit/sign` para firmar subidas; ya no se firma en el dev server de Vite.

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

### Dependencias principales

- NestJS (REST API con validación y CORS)
- Prisma ORM (MySQL) con seed inicial (usuarios, barberos, servicios, citas, festivos y horarios)
- ImageKit (firma de subidas desde `/api/imagekit/sign`)
- Superadmin configurable por email (env `SUPER_ADMIN_EMAIL` en backend y `VITE_SUPER_ADMIN_EMAIL` en frontend)
- Notificaciones: correo al crear/editar citas y recordatorio SMS 24h antes (Twilio)

### Variables de entorno clave (backend)

- `DATABASE_URL` (MySQL)
- `SUPER_ADMIN_EMAIL`
- ImageKit: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`
- Twilio (SMS): `TWILIO_AUTH_SID` (o `TWILIO_ACCOUNT_SID`), `TWILIO_ACCOUNT_TOKEN` (auth token), `TWILIO_MESSAGING_SERVICE_SID`
- Email (avisos): `EMAIL`, `PASSWORD` y opcional `EMAIL_HOST` (default `smtp.gmail.com`), `EMAIL_PORT` (default `587`)

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
