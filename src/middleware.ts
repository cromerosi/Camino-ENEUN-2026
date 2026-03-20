import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookieName, verifySignedSessionToken } from './lib/auth';
import { getAdminSessionCookieName, verifyAdminSessionToken } from './lib/admin-auth';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // --- ADMIN ROUTES ---
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const isAdminLoginRoute = pathname === '/admin/login' || pathname === '/api/admin/login';
    const adminSessionToken = request.cookies.get(getAdminSessionCookieName())?.value;
    
    let admin = null;
    try {
      if (adminSessionToken) {
        admin = await verifyAdminSessionToken(adminSessionToken);
      }
    } catch {
      admin = null;
    }

    if (!admin && !isAdminLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (admin && pathname === '/admin/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/sede';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  // --- STUDENT ROUTES ---
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  let user = null;
  try {
    user = await verifySignedSessionToken(sessionToken);
  } catch {
    user = null;
  }

  const isAuthRoute = pathname.startsWith('/api/auth');
  const isPublicRoute =
    pathname === '/landing' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/eneun.ico' ||
    pathname === '/eneun.svg' ||
    pathname.startsWith('/public');

  if (!user && !isAuthRoute && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/landing') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};

