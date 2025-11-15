import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../../app/layout';

jest.mock('next/headers', () => ({
  cookies: () => ({ get: () => ({ value: 'jwt' }) })
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('a', { href: props.href }, props.children),
}));

describe('RootLayout logout button', () => {
  const originalError = console.error;
  beforeAll(() => {
    console.error = (...args: any[]) => {
      if (typeof args[0] === 'string' && args[0].includes('validateDOMNesting')) return;
      originalError(...args);
    };
  });
  afterAll(() => { console.error = originalError; });
  it('shows logout button when authenticated', async () => {
    render(<RootLayout><div>content</div></RootLayout>);
    expect(await screen.findByRole('button', { name: /Sair/i })).toBeInTheDocument();
  });
});
