# Barberbook Pro Monorepo

Este repositorio contiene el código de **Barberbook Pro**, organizado como un **monorepo** que agrupa frontend (y en el futuro, backend).

## Estructura del proyecto

```text
.
├─ frontend/   # Aplicación web (Vite + React + TypeScript + Tailwind + shadcn-ui)
└─ backend/    # (Futuro) API / backend del proyecto
```

## Frontend

El frontend vive en `frontend/` y está construido con:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### Desarrollo local (solo frontend por ahora)

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
  - `VITE_IMAGEKIT_PUBLIC_KEY`
  - `VITE_IMAGEKIT_URL_ENDPOINT`
  - `IMAGEKIT_PRIVATE_KEY` (solo para firmar en local, no se expone al cliente).
- El `vite dev` expone un endpoint local `/api/imagekit/sign` que genera las firmas necesarias. En producción debes replicar este endpoint en tu backend o función serverless.

## Backend (futuro)

En el futuro, el backend se ubicará en la carpeta `backend/` y también formará parte de este mismo repositorio Git.

Cuando exista, la sección se podrá ampliar con:

- Tecnologías usadas (Node, Nest, Express, etc.)
- Cómo levantar el servidor en desarrollo
- Scripts de test y despliegue

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
