import {NextResponse} from 'next/server';
import {API_BASE, SESSION_COOKIE} from '../../../lib/config';

export async function POST() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {method: 'POST', credentials: 'include' as any});
    } catch {/* ignore backend issues */
    }
    const redirectUrl = new URL('/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(SESSION_COOKIE, '', {httpOnly: true, path: '/', maxAge: 0});
    return response;
}
