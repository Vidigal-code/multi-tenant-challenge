import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import InvitesPage from '../../app/invites/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../../store';

jest.mock('../../lib/http', () => ({
    http: {
        get: jest.fn((url: string) => {
            if (url === '/invites/profile') {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'me@example.com',
                        name: 'Test User'
                    }
                });
            }
            if (url === '/invites/created') {
                return Promise.resolve({
                    data: {
                        data: [{
                            id: 'i1',
                            companyId: 'c1',
                            email: 'me@example.com',
                            role: 'MEMBER',
                            status: 'PENDING',
                            token: 'tok1',
                            createdAt: new Date().toISOString(),
                            expiresAt: new Date().toISOString(),
                            name: 'Test Company',
                            description: 'Test Description'
                        }], 
                        total: 1
                    }
                });
            }
            if (url === '/invites') {
                return Promise.resolve({
                    data: {
                        data: [{
                            id: 'i1',
                            companyId: 'c1',
                            email: 'me@example.com',
                            role: 'MEMBER',
                            status: 'PENDING',
                            token: 'tok1',
                            createdAt: new Date().toISOString(),
                            expiresAt: new Date().toISOString()
                        }], 
                        total: 1
                    }
                });
            }
            return Promise.resolve({ data: { data: [], total: 0 } });
        }),
        post: jest.fn().mockResolvedValue({data: {success: true}}),
    }
}));

const {http} = jest.requireMock('../../lib/http');

describe('InvitesPage', () => {
    it('loads invites and accepts one', async () => {
        const qc = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        render(
            <ReduxProvider store={store}>
                <QueryClientProvider client={qc}>
                    <InvitesPage/>
                </QueryClientProvider>
            </ReduxProvider>
        );
        await waitFor(() => expect(screen.getByRole('heading', { name: /Convites/ })).toBeInTheDocument());
        // A aba padrão é 'created', então deve chamar '/invites/created'
        await waitFor(() => expect(http.get).toHaveBeenCalledWith('/invites/created', {params: {page: 1, pageSize: 10}}));

        // Mudar para aba 'received' para testar o botão Aceitar
        fireEvent.click(await screen.findByText('Convites Recebidos'));
        await waitFor(() => expect(http.get).toHaveBeenCalledWith('/invites', {params: {page: 1, pageSize: 10}}));
        
        fireEvent.click(await screen.findByRole('button', {name: /Aceitar/i}));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/auth/accept-invites', {token: 'tok1'}));
    });
});
