import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider as ReduxProvider } from 'react-redux';
import NavAuthMenu from '../../components/nav/NavAuthMenu';
import { store } from '../../store';

jest.mock('../../components/themes/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe('NavAuthMenu logout button', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('shows logout button when authenticated', async () => {
    render(
      <ReduxProvider store={store}>
        <NavAuthMenu initialAuth={true} />
      </ReduxProvider>
    );
    expect(await screen.findByRole('button', { name: /Sair/i })).toBeInTheDocument();
  });
});
