import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../../store';
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

jest.mock('../../lib/http', () => ({
  http: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../services/api/auth.api', () => ({
  useProfile: () => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  }),
  usePrimaryOwnerCompanies: () => ({
    data: { companies: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
  useMemberCompanies: () => ({
    data: { companies: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
  }),
}));

jest.mock('../../services/api/company.api', () => ({
  useSelectCompany: () => ({
    mutate: jest.fn(),
    isLoading: false,
  }),
  useDeleteCompany: () => ({
    mutate: jest.fn(),
    isLoading: false,
  }),
  useLeaveCompany: () => ({
    mutate: jest.fn(),
    isLoading: false,
  }),
  useUpdateCompany: () => ({
    mutate: jest.fn(),
    isLoading: false,
  }),
  useCompany: () => ({
    data: null,
    isLoading: false,
  }),
}));

jest.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    show: jest.fn(),
  }),
}));

describe('DashboardPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 0 },
        mutations: { retry: false },
      },
    });
  });

  it('renders header', () => {
    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <DashboardPage />
        </QueryClientProvider>
      </ReduxProvider>
    );
    expect(screen.getByText('Minhas Empresas')).toBeInTheDocument();
  });
});
