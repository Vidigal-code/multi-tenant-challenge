import { middleware } from '../middleware';

jest.mock('next/server', () => {
  class FakeNextResponse {
    static next() { return new FakeNextResponse(); }
    static redirect(url: any) {
      const r = new FakeNextResponse();
      (r as any).headers = new Map([["location", url.toString()]]);
      return r as any;
    }
    headers = new Map();
  }
  return { NextResponse: FakeNextResponse };
});

function makeRequest(path: string, cookie?: string) {
  const url = new URL('http://localhost' + path);
  const nextUrl: any = {
    pathname: url.pathname,
    toString: function () { return `http://localhost${this.pathname}`; },
    clone: function () { return { pathname: this.pathname, toString: this.toString } as any; },
  };
  return {
    nextUrl,
    cookies: { get: () => (cookie ? { value: cookie } : undefined) },
  } as any;
}

describe('middleware auth', () => {
  it('redirects anonymous to /login', () => {
    const res: any = middleware(makeRequest('/dashboard'));
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });
  it('allows anonymous on /login', () => {
    const res: any = middleware(makeRequest('/login'));
    expect(res.headers.get('location')).toBeUndefined();
  });
  it('redirects authenticated away from /login', () => {
    const res: any = middleware(makeRequest('/login', 'jwt'));
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });
  it('passes authenticated through to /dashboard', () => {
    const res: any = middleware(makeRequest('/dashboard', 'jwt'));
    expect(res.headers.get('location')).toBeUndefined();
  });
});
