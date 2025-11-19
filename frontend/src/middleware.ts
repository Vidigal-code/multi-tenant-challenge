import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';
import {SESSION_COOKIE} from './lib/config';

export function middleware(request: NextRequest) {
    const session = request.cookies.get(SESSION_COOKIE);
    const isAuth = Boolean(session?.value);
    const {pathname} = request.nextUrl;

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
    const isInvite = pathname.startsWith('/invites/');
    const isApi = pathname.startsWith('/api');
    const isHome = pathname === '/';
    const isInfo = pathname.startsWith('/info');
    const isPublic = isAuthPage || isInvite || isApi || isHome || isInfo;

    if (isAuth && isAuthPage) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    if (!isAuth && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
