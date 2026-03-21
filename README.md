# ENEUN Web App

Aplicación web del flujo ENEUN construida con Next.js (Pages Router), React 19 y PostgreSQL.

Incluye:

- Portal de participante (inicio de sesión, dashboard, formulario final).
- Módulo administrativo para validaciones por sede.
- Persistencia en PostgreSQL usando `postgres` (postgres.js).
- Middleware de protección por sesión para rutas de estudiante y admin.

## Stack técnico

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- PostgreSQL

## Requisitos

- Node.js 22.x
- npm 10+
- Base de datos PostgreSQL accesible desde `DATABASE_URL`

## Inicio rápido

1. Instalar dependencias:

```bash
npm install
```

2. Crear archivo `.env` en la raíz del proyecto.

3. Ejecutar en desarrollo:

```bash
npm run dev
```

4. Abrir:

- `http://localhost:3000/landing` (login estudiante)
- `http://localhost:3000/admin/login` (login admin)

## Variables de entorno

Variables mínimas recomendadas:

```env
# Base de datos
DATABASE_URL=postgres://usuario:password@host:5432/db

# Auth0 (estudiantes)
AUTH0_DOMAIN=tu-tenant.us.auth0.com
AUTH0_CLIENT_ID=xxxxxxxx
AUTH0_CLIENT_SECRET=xxxxxxxx
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth/callback
AUTH0_CONNECTION=google-oauth2

# Firma de sesión
AUTH_SESSION_SECRET=clave-larga-y-segura

# Compatibilidad legacy (opcional)
ADMIN_JWT_SECRET=clave-opcional
```

Notas:

- `AUTH0_CLIENT_SECRET` puede omitirse si se usa flujo PKCE correctamente configurado.
- Si no defines `AUTH_SESSION_SECRET`, el proyecto usa un valor de desarrollo (no recomendado para producción).

## Scripts

```bash
npm run dev    # entorno local
npm run build  # build producción
npm run start  # servidor producción
npm run lint   # lint (Next)
```

## Arquitectura del proyecto

```text
src/
	lib/                 # Auth, DB, lógica de negocio y agregaciones
	middleware.ts        # Protección de rutas por sesión
	modules/             # UI y utilidades del formulario final
	pages/
		index.tsx          # Dashboard participante
		landing.tsx        # Login estudiante
		formulario-final.tsx
		admin/
			login.tsx
			sede.tsx
		api/
			auth/            # login/callback/logout estudiante
			admin/           # login/logout y validaciones admin
			final-form/      # envío formulario final
```

## Flujos principales

### 1) Estudiante

1. Entra por `/landing`.
2. Se autentica con Auth0 (dominio `@unal.edu.co`).
3. Llega a `/` (dashboard con nodos del proceso ENEUN).
4. Desde el dashboard va a `/formulario-final`.
5. Al enviar, los datos se guardan en `attendees`.

### 2) Admin

1. Entra por `/admin/login`.
2. Valida credenciales contra tabla `admins`.
3. Accede a `/admin/sede` para gestión de validaciones.

## Base de datos (resumen)

Tablas usadas por el flujo actual (según código):

- `registrations`
- `confirmation_submissions`
- `attendees`
- `admins`
- `sede_validations`
- `student_sede_validations`

### Tabla `attendees`

El endpoint `POST /api/final-form/submit` crea/actualiza la tabla `attendees` si no existe y guarda:

- Campos normalizados (identificación, sede, pronombre, contacto, hospedaje, transporte, etc.).
- `health_condition_codes` como arreglo.
- `health_details` como `jsonb` estructurado.
- `payload` como `jsonb` con formato legible para auditoría.

## Middleware y seguridad

`src/middleware.ts` aplica:

- Rutas `/admin` y `/api/admin`: requieren sesión admin.
- Rutas de estudiante privadas: requieren sesión estudiante.
- `/landing` redirige a `/` cuando ya existe sesión activa.

Cookies de sesión:

- Estudiante: `eneun_session`
- Admin: `eneun_admin_session`

## Troubleshooting

### Error: Missing required environment variable: DATABASE_URL

Define `DATABASE_URL` en `.env` y reinicia el servidor.

### Login Auth0 falla en callback

Verifica:

- `AUTH0_DOMAIN`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET` (si aplica)
- `AUTH0_CALLBACK_URL`

Y que la URL de callback coincida en el panel de Auth0.

### El formulario final no cambia a estado completado

El nodo final del dashboard depende de registros existentes en la tabla `attendees` para ese participante (`attendee_id = registrations.id`).

## Recomendaciones para producción

- Configurar secretos fuertes (`AUTH_SESSION_SECRET`).
- Activar HTTPS para que las cookies `Secure` se apliquen correctamente.
- Definir migraciones SQL versionadas en lugar de depender solo de creación dinámica en endpoints.
- Implementar hash seguro para contraseñas admin (bcrypt/argon2), en lugar de comparación en texto plano.

---

Si necesitas, puedo agregar también una sección de despliegue (Vercel/Node server) y una plantilla de migraciones SQL para todas las tablas usadas por ENEUN.
