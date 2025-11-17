import { render, screen } from '@testing-library/react';
import DashboardPage from '../../app/dashboard/page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

describe('DashboardPage', () => {
  it('renders header', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Minhas Empresas')).toBeInTheDocument();
  });
});
