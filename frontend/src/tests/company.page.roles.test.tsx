import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CompanyPage from '../app/company/[id]/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../store';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(() => ({ id: 'c1' })),
}));

jest.mock('../lib/http', () => ({
  http: {
    post: jest.fn().mockResolvedValue({ data: {} }),
    get: jest.fn((url: string) => {
      if(url.includes('/auth/profile')) return Promise.resolve({ data: { id: 'u1', email: 'user@test.com', name: 'User' } });
      if(url.includes('/members/role')) return Promise.resolve({ data: { role: 'OWNER' }});
      if(url.includes('/members')) return Promise.resolve({ data: { members: [{ id:'m1', userId:'u1', role:'OWNER'}], total: 1, currentUserRole: 'OWNER' } });
      if(url.includes('/company/c1')) return Promise.resolve({ data: { id: 'c1', name: 'Company c1', logoUrl: null, description: 'Test company', is_public: true } });
      if(url.includes('/primary-owner')) return Promise.resolve({ data: { primaryOwnerUserId: 'u1', primaryOwnerName: 'User', primaryOwnerEmail: 'user@test.com' } });
      return Promise.resolve({ data: {} });
    }),
    patch: jest.fn().mockResolvedValue({ data: { id:'c1', name:'New', logoUrl:null }}),
    delete: jest.fn().mockResolvedValue({ data: { success:true } }),
  }
}));
const { http } = jest.requireMock('../lib/http');

describe('CompanyPage role-based actions', () => {
  const { useParams } = require('next/navigation');
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ id: 'c1' });
    (http.get as jest.Mock).mockImplementation((url: string) => {
      if(url.includes('/auth/profile')) return Promise.resolve({ data: { id: 'u1', email: 'user@test.com', name: 'User' } });
      if(url.includes('/members/role')) return Promise.resolve({ data: { role: 'OWNER' }});
      if(url.includes('/members')) return Promise.resolve({ data: { members: [{ id:'m1', userId:'u1', role:'OWNER'}], total: 1, currentUserRole: 'OWNER' } });
      if(url.includes('/company/c1')) return Promise.resolve({ data: { id: 'c1', name: 'Company c1', logoUrl: null, description: 'Test company', is_public: true } });
      if(url.includes('/primary-owner')) return Promise.resolve({ data: { primaryOwnerUserId: 'u1', primaryOwnerName: 'User', primaryOwnerEmail: 'user@test.com' } });
      return Promise.resolve({ data: {} });
    });
  });

  it('renders OWNER actions', async () => {
    const qc = new QueryClient();
    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={qc}>
          <CompanyPage />
        </QueryClientProvider>
      </ReduxProvider>
    );
  await waitFor(()=> expect(screen.getByText(/Company c1/)).toBeInTheDocument());
  expect(await screen.findByText('Editar empresa')).toBeInTheDocument();
  expect(await screen.findByText('Excluir empresa')).toBeInTheDocument();
  });

  it('renders ADMIN actions (no delete)', async () => {
    (http.get as jest.Mock).mockImplementation((url: string) => {
      if(url.includes('/auth/profile')) return Promise.resolve({ data: { id: 'u1', email: 'user@test.com', name: 'User' } });
      if(url.includes('/members/role')) return Promise.resolve({ data: { role: 'ADMIN' }});
      if(url.includes('/members')) return Promise.resolve({ data: { members: [{ id:'m1', userId:'u1', role:'ADMIN'}], total: 1, currentUserRole: 'ADMIN' } });
      if(url.includes('/company/c1')) return Promise.resolve({ data: { id: 'c1', name: 'Company c1', logoUrl: null, description: 'Test company', is_public: true } });
      if(url.includes('/primary-owner')) return Promise.resolve({ data: { primaryOwnerUserId: 'u1', primaryOwnerName: 'User', primaryOwnerEmail: 'user@test.com' } });
      return Promise.resolve({ data: {} });
    });
    const qc = new QueryClient();
    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={qc}>
          <CompanyPage />
        </QueryClientProvider>
      </ReduxProvider>
    );
  await screen.findByText('Editar empresa');
    expect(screen.queryByText('Excluir empresa')).toBeNull();
  });

  it('renders MEMBER (no management buttons)', async () => {
    (http.get as jest.Mock).mockImplementation((url: string) => {
      if(url.includes('/auth/profile')) return Promise.resolve({ data: { id: 'u1', email: 'user@test.com', name: 'User' } });
      if(url.includes('/members/role')) return Promise.resolve({ data: { role: 'MEMBER' }});
      if(url.includes('/members')) return Promise.resolve({ data: { members: [{ id:'m1', userId:'u1', role:'MEMBER'}], total: 1, currentUserRole: 'MEMBER' } });
      if(url.includes('/company/c1')) return Promise.resolve({ data: { id: 'c1', name: 'Company c1', logoUrl: null, description: 'Test company', is_public: true } });
      if(url.includes('/primary-owner')) return Promise.resolve({ data: { primaryOwnerUserId: 'u1', primaryOwnerName: 'User', primaryOwnerEmail: 'user@test.com' } });
      return Promise.resolve({ data: {} });
    });
    const qc = new QueryClient();
    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={qc}>
          <CompanyPage />
        </QueryClientProvider>
      </ReduxProvider>
    );
  await waitFor(()=> expect(screen.getByText(/Company c1/)).toBeInTheDocument());
    expect(screen.queryByText('Editar empresa')).toBeNull();
    expect(screen.queryByText('Excluir empresa')).toBeNull();
  });

  it('allows editing company (OWNER)', async () => {
    const qc = new QueryClient();
    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={qc}>
          <CompanyPage />
        </QueryClientProvider>
      </ReduxProvider>
    );
  await screen.findByText('Editar empresa');
  fireEvent.click(await screen.findByText('Editar empresa'));
    fireEvent.change(screen.getByPlaceholderText('Novo nome'), { target: { value: 'Acme X' } });
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await waitFor(()=> expect(http.patch).toHaveBeenCalledWith('/company/c1', { name: 'Acme X', logoUrl: undefined, description: 'Test company', is_public: true }));
  });
});
