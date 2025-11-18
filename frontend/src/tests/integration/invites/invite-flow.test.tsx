import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../../store';
import InvitesPage from '../../../app/invites/page';
import InvitePage from '../../../app/invite/[token]/page';
import {http} from '../../../lib/http';

jest.mock('../../../lib/http', () => ({
    http: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
    useParams: () => ({token: 'token123'}),
    redirect: jest.fn(),
}));

jest.mock('../../../lib/realtime', () => ({
    subscribe: jest.fn(() => () => {}),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        INVITE_ACCEPTED: 'invites.accepted',
        INVITE_REJECTED: 'invites.rejected',
    },
}));

const {http: httpMock} = jest.requireMock('../../../lib/http');

describe('Invite Flow Integration', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {retry: false, staleTime: 0},
                mutations: {retry: false},
            },
        });
        jest.clearAllMocks();
    });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <ReduxProvider store={store}>
                <QueryClientProvider client={queryClient}>
                    {component}
                </QueryClientProvider>
            </ReduxProvider>
        );
    };

    it('complete flow: view invites -> accept -> verify', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'recipient@test.com',
                        name: 'Recipient',
                    },
                });
            }
            if (url.includes('/invites') && !url.includes('/invites/created') && !url.includes('/invites/') && !url.includes('/invites?') && !url.includes('token')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'i1',
                                companyId: 'c1',
                                email: 'recipient@test.com',
                                role: 'MEMBER',
                                status: 'PENDING',
                                token: 'token123',
                                createdAt: new Date().toISOString(),
                                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                name: 'Test Company',
                                description: 'Test Description',
                            },
                        ],
                        total: 1,
                    },
                });
            }
            if (url.includes('/invites/created')) {
                return Promise.resolve({
                    data: {
                        data: [],
                        total: 0,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<InvitesPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /Convites/i})).toBeInTheDocument();
        });

        const receivedTab = screen.getByText(/Convites Recebidos/i);
        fireEvent.click(receivedTab);

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.post.mockResolvedValueOnce({
            data: {
                user: {
                    id: 'u1',
                    email: 'recipient@test.com',
                },
                companyId: 'c1',
            },
        });

        const acceptButton = screen.getByRole('button', {name: /aceitar/i});
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/auth/accept-invites', { token: 'token123' });
        }, { timeout: 5000 });
    });

    it('view created invites -> delete invites', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'owner@test.com',
                        name: 'Owner',
                    },
                });
            }
            if (url.includes('/invites/created')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'i1',
                                companyId: 'c1',
                                email: 'member@test.com',
                                role: 'MEMBER',
                                status: 'PENDING',
                                token: 'token123',
                                inviterId: 'u1',
                                createdAt: new Date().toISOString(),
                                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                name: 'Test Company',
                                description: 'Test Description',
                            },
                        ],
                        total: 1,
                    },
                });
            }
            if (url.includes('/invites') && !url.includes('/invites/created') && !url.includes('/invites/') && !url.includes('token')) {
                return Promise.resolve({
                    data: {
                        data: [],
                        total: 0,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<InvitesPage />);

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.delete.mockResolvedValueOnce({
            data: {success: true},
        });

        const deleteButtons = screen.getAllByRole('button', {name: /Deletar/i});
        const deleteButton = deleteButtons.find(btn => btn.textContent === 'Deletar' && !(btn as HTMLButtonElement).disabled) || deleteButtons[deleteButtons.length - 1];
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText(/Confirmar/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', {name: /Confirmar/i});
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(httpMock.delete).toHaveBeenCalledWith('/invites/i1');
        });
    });

    it('accept invites via link', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'recipient@test.com',
                        name: 'Recipient',
                    },
                });
            }
            if (url.includes('/invites/token123')) {
                return Promise.resolve({
                    data: {
                        id: 'i1',
                        companyId: 'c1',
                        email: 'recipient@test.com',
                        role: 'MEMBER',
                        status: 'PENDING',
                        token: 'token123',
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        companyName: 'Test Company',
                        companyLogo: 'https://example.com/logo.png',
                        companyDescription: null,
                        company: {
                            id: 'c1',
                            name: 'Test Company',
                        },
                        isInviter: false,
                        isRecipient: true,
                        canAccept: true,
                        canReject: true,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<InvitePage />);

        await waitFor(() => {
            expect(screen.queryByText(/Carregando convite/i)).not.toBeInTheDocument();
        }, {timeout: 3000});

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.post.mockResolvedValueOnce({
            data: {
                user: {
                    id: 'u1',
                    email: 'recipient@test.com',
                },
                companyId: 'c1',
            },
        });

        const acceptButton = screen.getByRole('button', {name: /aceitar/i});
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/invites/token123/accept');
        }, { timeout: 5000 });
    });

    it('reject invites via link', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'recipient@test.com',
                        name: 'Recipient',
                    },
                });
            }
            if (url.includes('/invites/token123')) {
                return Promise.resolve({
                    data: {
                        id: 'i1',
                        companyId: 'c1',
                        email: 'recipient@test.com',
                        role: 'MEMBER',
                        status: 'PENDING',
                        token: 'token123',
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                        companyName: 'Test Company',
                        companyLogo: 'https://example.com/logo.png',
                        companyDescription: null,
                        company: {
                            id: 'c1',
                            name: 'Test Company',
                        },
                        isInviter: false,
                        isRecipient: true,
                        canAccept: true,
                        canReject: true,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<InvitePage />);

        await waitFor(() => {
            expect(screen.queryByText(/Carregando convite/i)).not.toBeInTheDocument();
        }, {timeout: 3000});

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        const rejectButton = screen.getByRole('button', {name: /rejeitar/i});
        fireEvent.click(rejectButton);

        await waitFor(() => {
            expect(screen.getByText(/confirmar/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', {name: /confirmar/i});
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/invites/token123/reject');
        });
    });
});

