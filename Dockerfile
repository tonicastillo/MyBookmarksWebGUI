# Etapa 1: Build del frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias del frontend
COPY package.json pnpm-lock.yaml ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente del frontend
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY postcss.config.js tailwind.config.js ./

# Build del frontend
RUN pnpm run build

# Etapa 2: Build del backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar archivos de dependencias del backend
COPY backend/package.json backend/pnpm-lock.yaml ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente del backend
COPY backend/src/ ./src/
COPY backend/tsconfig.json ./

# Build del backend
RUN pnpm run build

# Etapa 3: Imagen de producción
FROM node:20-alpine AS production

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar package.json del backend y instalar solo dependencias de producción
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copiar el backend compilado
COPY --from=backend-builder /app/backend/dist ./dist

# Copiar el frontend compilado
COPY --from=frontend-builder /app/dist ./public

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3003

# Exponer puerto
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/api/health || exit 1

# Comando de inicio
CMD ["node", "dist/index.js"]
