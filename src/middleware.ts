import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSessionCookieName, verifySignedSessionToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(getSessionCookieName())?.value;
  let user = null;
  try {
    user = await verifySignedSessionToken(sessionToken);
  } catch {
    user = null;
  }

  const pathname = request.nextUrl.pathname;
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
