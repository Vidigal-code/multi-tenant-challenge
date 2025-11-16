const rawApiBase = process.env.NEXT_PUBLIC_API_URL;
const normalizedApiBase = rawApiBase && rawApiBase !== 'undefined' && rawApiBase !== 'null' ? rawApiBase : undefined;
export const API_BASE = normalizedApiBase ?? 'http://localhost:4000';

const rawCookieName = process.env.NEXT_PUBLIC_SESSION_COOKIE;
const normalizedCookieName = rawCookieName && rawCookieName !== 'undefined' && rawCookieName !== 'null' ? rawCookieName : undefined;
export const SESSION_COOKIE = normalizedCookieName ?? 'mt_session';
