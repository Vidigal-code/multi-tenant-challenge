import React from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout from '../app/layout';
import { ThemeProvider } from '../contexts/ThemeContext';

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
      if (typeof args[0] === 'string' && args[0].includes('useTheme must be used within a ThemeProvider')) return;
      originalError(...args);
    };
  });
  afterAll(() => { console.error = originalError; });
  it('shows logout button when authenticated', async () => {
    render(
      <ThemeProvider>
        <RootLayout><div>content</div></RootLayout>
      </ThemeProvider>
    );
    expect(await screen.findByRole('button', { name: /Sair/i })).toBeInTheDocument();
  });
});
