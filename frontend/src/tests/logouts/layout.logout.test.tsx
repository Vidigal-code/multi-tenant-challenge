import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../../store';
import NavAuthMenu from '../../components/nav/NavAuthMenu';

jest.mock('next/link', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('a', { href: props.href }, props.children),
}));

jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    logout: jest.fn(),
  }),
}));

describe('RootLayout logout button', () => {
  it('shows logout button when authenticated', async () => {
    render(
      <ReduxProvider store={store}>
        <NavAuthMenu initialAuth={true} />
      </ReduxProvider>
    );
    expect(await screen.findByRole('button', { name: /Sair/i })).toBeInTheDocument();
  });
});
