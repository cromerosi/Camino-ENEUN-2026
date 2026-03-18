# ENEUN - Proyecto en React (Next.js)

Este proyecto fue migrado de Astro a Next.js (React) manteniendo:

- Middleware de autenticacion por cookie de sesion.
- Rutas API en `src/pages/api`.
- Paginas SSR para dashboard (`/`) y login (`/landing`).
- Estilos con Tailwind CSS v4.

## Requisitos

- Node.js 22.12.0 o superior.
- Variables de entorno para base de datos y autenticacion.

## Comandos

```bash
npm install
npm run dev
```

Servidor de desarrollo: `http://localhost:3000`

Otros comandos:

```bash
npm run build
npm run start
```
