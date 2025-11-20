import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import InvitesPage from '../../app/invites/page';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../../store';

jest.mock('../../lib/http', () => ({
    http: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    }
}));

const {http} = jest.requireMock('../../lib/http');

const CREATED_JOB_ID = 'job-created';
const RECEIVED_JOB_ID = 'job-received';
const createdInvite = {
    id: 'i1',
    companyId: 'c1',
    email: 'me@example.com',
    role: 'MEMBER',
    status: 'PENDING',
    token: 'tok1',
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
    name: 'Created Company',
    description: 'Created Description',
};
const receivedInvite = {
    ...createdInvite,
    id: 'i2',
    token: 'tok2',
    name: 'Received Company',
    description: 'Received Description',
};

describe('InvitesPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        http.get.mockImplementation((url: string) => {
            if (url === '/auth/profile') {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'me@example.com',
                        name: 'Test User',
                    },
                });
            }
            if (url === `/invites/listing/${CREATED_JOB_ID}`) {
                return Promise.resolve({
                    data: {
                        items: [createdInvite],
                        total: 1,
                        status: 'completed',
                        done: true,
                        nextCursor: null,
                    },
                });
            }
            if (url === `/invites/listing/${RECEIVED_JOB_ID}`) {
                return Promise.resolve({
                    data: {
                        items: [receivedInvite],
                        total: 1,
                        status: 'completed',
                        done: true,
                        nextCursor: null,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
        http.post.mockImplementation((url: string, payload?: any) => {
            if (url === '/invites/listing') {
                const jobId = payload?.type === 'created' ? CREATED_JOB_ID : RECEIVED_JOB_ID;
                return Promise.resolve({
                    data: {
                        jobId,
                        status: 'pending',
                        processed: 0,
                        items: [],
                        done: false,
                    },
                });
            }
            if (url === '/auth/accept-invites') {
                return Promise.resolve({ data: { success: true } });
            }
            return Promise.resolve({ data: { success: true } });
        });
        http.delete.mockResolvedValue({ data: { success: true } });
    });

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

        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/invites/listing', { type: 'created' }));
        await waitFor(() => expect(screen.getByText(/Created Company/i)).toBeInTheDocument());

        // Mudar para aba 'received' para testar o botão Aceitar
        fireEvent.click(await screen.findByText('Convites Recebidos'));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/invites/listing', { type: 'received' }));
        await waitFor(() => expect(screen.getByText(/Received Company/i)).toBeInTheDocument());
        
        fireEvent.click(await screen.findByRole('button', {name: /Aceitar/i}));
        await waitFor(() => expect(http.post).toHaveBeenCalledWith('/auth/accept-invites', {token: 'tok2'}));
    });
});
