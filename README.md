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
# Base de datos principal
DATABASE_URL=postgres://usuario:password@host:5432/db

# Base de datos de la plataforma de capacitaciones (tabla student_capacitaciones)
TRAINING_DATABASE_URL=postgres://usuario:password@host/db?sslmode=require

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
- Si no defines `AUTH_SESSION_SECRET`, el proyecto usa un valor de desarrollo **inseguro** (cualquiera podría falsificar sesiones). En producción debe estar definido; si falta, el servidor lo reporta en los logs.
- `TRAINING_DATABASE_URL` es obligatoria para mostrar el estado del paso "Capacitaciones de la plataforma". Si falta, ese paso aparece siempre "en curso".
- Opcional: `FINAL_FORM_URL` para enlazar un formulario final externo en lugar de `/formulario-final`.

## Scripts

```bash
npm run dev    # entorno local
npm run build  # build producción
npm run start  # servidor producción
npm run lint   # lint (Next)
npm run typecheck  # verificación de tipos con TypeScript
```

## Arquitectura del proyecto

```text
src/
	lib/                 # Auth, DB, lógica de negocio y agregaciones
		db.ts              # Conexiones a la BD principal y a la de capacitaciones
		session-token.ts   # Firma/verificación HMAC de cookies de sesión
		auth.ts            # Sesión de estudiante y flujo Auth0
		admin-auth.ts      # Sesión de admin y permisos por sede
		campus.ts          # Normalización de nombres de sede
		participant.ts     # Datos del participante y "Camino ENEUN"
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
3. Accede a `/admin/sede` para gestión de validaciones (máximo 7 por sede). Los admins multisede o globales eligen la sede al crear una validación.
4. "Ver index" abre el panel del participante en modo vista previa (`/?previewEmail=...`), solo para estudiantes de sus sedes.

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
- Las rutas `/api/*` sin sesión responden `401` en JSON (las páginas redirigen al login).
- `/landing` redirige a `/` cuando ya existe sesión activa.
- Modo mantenimiento: cambia `MAINTENANCE_MODE` a `true` en `src/middleware.ts`.

Cookies de sesión:

- Estudiante: `eneun_session`
- Admin: `eneun_admin_session`

## Troubleshooting

### Error: Missing required environment variable: DATABASE_URL

Define `DATABASE_URL` en `.env` y reinicia el servidor.

### El paso "Capacitaciones de la plataforma" nunca aparece completado

Verifica que `TRAINING_DATABASE_URL` esté definida (también en Vercel) y que la tabla `student_capacitaciones` sea accesible.

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
- No guardar credenciales en el código: todas las conexiones se configuran por variables de entorno.
