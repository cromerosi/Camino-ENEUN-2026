import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookieName, verifySignedSessionToken } from './lib/auth';
import { getAdminSessionCookieName, verifyAdminSessionToken } from './lib/admin-auth';

const MAINTENANCE_MODE = false; // Cambia a true para activar el modo mantenimiento
const MAINTENANCE_PATH = '/mantenimiento';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
};

const PUBLIC_FILES = new Set(['/favicon.ico', '/favicon.svg', '/eneun.ico', '/eneun.svg']);

// Rutas de admin accesibles sin sesión (el logout debe poder limpiar una cookie vencida).
const ADMIN_PUBLIC_ROUTES = new Set(['/admin/login', '/api/admin/login', '/api/admin/logout']);

function isStaticAsset(pathname: string): boolean {
  return pathname.startsWith('/_next') || pathname.startsWith('/public') || PUBLIC_FILES.has(pathname);
}

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

function unauthorizedJson(): NextResponse {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401, headers: NO_STORE_HEADERS });
}

async function readAdminSession(request: NextRequest) {
  try {
    return await verifyAdminSessionToken(request.cookies.get(getAdminSessionCookieName())?.value);
  } catch {
    return null;
  }
}

async function readStudentSession(request: NextRequest) {
  try {
    return await verifySignedSessionToken(request.cookies.get(getSessionCookieName())?.value);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (MAINTENANCE_MODE) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json(
        { message: 'La plataforma se encuentra en mantenimiento. Intenta nuevamente más tarde.' },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    if (pathname !== MAINTENANCE_PATH && !isStaticAsset(pathname)) {
      return redirectTo(request, MAINTENANCE_PATH);
    }

    return NextResponse.next();
  }

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // --- RUTAS DE ADMIN ---
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const admin = await readAdminSession(request);

    if (!admin && !ADMIN_PUBLIC_ROUTES.has(pathname)) {
      return pathname.startsWith('/api/') ? unauthorizedJson() : redirectTo(request, '/admin/login');
    }

    if (admin && pathname === '/admin/login') {
      return redirectTo(request, '/admin/sede');
    }

    return NextResponse.next();
  }

  // --- RUTAS DE ESTUDIANTE ---
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  const user = await readStudentSession(request);

  if (user && pathname === '/landing') {
    return redirectTo(request, '/');
  }

  if (user || pathname === '/landing') {
    return NextResponse.next();
  }

  // Vista previa del panel del participante desde el panel admin ("Ver index").
  // getServerSideProps vuelve a validar la sesión y los permisos de sede.
  if (pathname === '/' && request.nextUrl.searchParams.has('previewEmail')) {
    const admin = await readAdminSession(request);
    if (admin) {
      return NextResponse.next();
    }
  }

  return pathname.startsWith('/api/') ? unauthorizedJson() : redirectTo(request, '/landing');
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
