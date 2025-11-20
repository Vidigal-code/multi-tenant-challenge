import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../../store';
import DashboardPage from '../../../app/dashboard/page';
import CompanyPage from '../../../app/company/[id]/page';
import {http} from '../../../lib/http';

jest.mock('../../../lib/http', () => ({
    http: {
        get: jest.fn(),
        post: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
    },
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
    useParams: () => ({id: 'c1'}),
    redirect: jest.fn(),
}));

jest.mock('../../../lib/realtime', () => ({
    subscribe: jest.fn(() => () => {}),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        COMPANY_UPDATED: 'companys.updated',
        MEMBER_JOINED: 'member.joined',
        MEMBER_LEFT: 'member.left',
    },
}));

const {http: httpMock} = jest.requireMock('../../../lib/http');

describe('Company Flow Integration', () => {
    let queryClient: QueryClient;

    beforeAll(() => {
        jest.setTimeout(30000);
    });

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

    it('complete flow: list companies -> select -> view -> edit -> invites', async () => {
        const ownerJobId = 'owner-job';
        const memberJobId = 'member-job';
        httpMock.get.mockImplementation((url: string) => {
            if (url === '/auth/profile') {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'owner@test.com',
                        name: 'Owner',
                    },
                });
            }
            if (url === `/auth/account/primary-owner-companies/listing/${ownerJobId}`) {
                return Promise.resolve({
                    data: {
                        items: [
                            {
                                id: 'c1',
                                name: 'Test Company',
                                logoUrl: 'https://example.com/logo.png',
                                description: 'Primary owner company',
                                isPublic: false,
                                createdAt: new Date().toISOString(),
                                memberCount: 1,
                                primaryOwnerName: 'Owner',
                                primaryOwnerEmail: 'owner@test.com',
                            },
                        ],
                        total: 1,
                        status: 'completed',
                        done: true,
                    },
                });
            }
            if (url === `/auth/account/member-companies/listing/${memberJobId}`) {
                return Promise.resolve({
                    data: {
                        items: [],
                        total: 0,
                        status: 'completed',
                        done: true,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
        httpMock.post.mockImplementation((url: string) => {
            if (url === '/auth/account/primary-owner-companies/listing') {
                return Promise.resolve({
                    data: {
                        jobId: ownerJobId,
                        status: 'pending',
                        processed: 0,
                        items: [],
                        done: false,
                    },
                });
            }
            if (url === '/auth/account/member-companies/listing') {
                return Promise.resolve({
                    data: {
                        jobId: memberJobId,
                        status: 'pending',
                        processed: 0,
                        items: [],
                        done: false,
                    },
                });
            }
            if (url === '/company/c1/select') {
                return Promise.resolve({ data: { success: true } });
            }
            return Promise.resolve({ data: { success: true } });
        });
        httpMock.delete.mockResolvedValue({ data: {} });

        renderWithProviders(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        const selectButton = screen.getByText(/Ver empresa/i);
        fireEvent.click(selectButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/company/c1/select');
        });

        // Reset mocks and set up new implementation for CompanyPage
        jest.clearAllMocks();
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
            if (url.includes('/companys/c1/members/role')) {
                return Promise.resolve({
                    data: {
                        role: 'OWNER',
                    },
                });
            }
            if (url.includes('/companys/c1/members/primary-owner')) {
                return Promise.resolve({
                    data: {
                        primaryOwnerUserId: 'u1',
                        primaryOwnerName: 'Owner',
                        primaryOwnerEmail: 'owner@test.com',
                    },
                });
            }
            if (url.includes('/companys/c1/members') && !url.includes('/role') && !url.includes('/primary-owner')) {
                return Promise.resolve({
                    data: {
                        members: [
                            {
                                id: 'm1',
                                userId: 'u1',
                                role: 'OWNER',
                                name: 'Owner',
                                email: 'owner@test.com',
                                joinedAt: new Date().toISOString(),
                            },
                        ],
                        total: 1,
                        currentUserRole: 'OWNER',
                    },
                });
            }
            if (url.includes('/company/c1') && !url.includes('/members') && !url.includes('/public-info')) {
                return Promise.resolve({
                    data: {
                        id: 'c1',
                        name: 'Test Company',
                        logoUrl: 'https://example.com/logo.png',
                        description: 'Test Description',
                        is_public: false,
                        createdAt: new Date().toISOString(),
                    },
                });
            }
            if (url.includes('/friendships?status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        renderWithProviders(<CompanyPage />);

        await waitFor(() => {
            const companyElements = screen.getAllByText(/Test Company/i);
            expect(companyElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        await waitFor(() => {
            expect(screen.getByText(/Test Description/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /editar empresa/i }).length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        const editButtons = screen.getAllByRole('button', { name: /editar empresa/i });
        const editButton = editButtons[editButtons.length - 1];
        fireEvent.click(editButton);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/novo nome/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText(/novo nome/i), {
            target: {value: 'Updated Company'},
        });

        httpMock.patch.mockResolvedValueOnce({
            data: {
                id: 'c1',
                name: 'Updated Company',
            },
        });

        fireEvent.submit(screen.getByText(/salvar/i).closest('form')!);

        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/company/c1', expect.objectContaining({
                name: 'Updated Company',
            }));
        });

        await waitFor(() => {
            expect(screen.getByText(/formulário de convite/i)).toBeInTheDocument();
        });

        const inviteForm = screen.getByPlaceholderText(/Email ou ID do usuário/i);
        fireEvent.change(inviteForm, {
            target: {value: 'member@test.com'},
        });

        httpMock.post.mockResolvedValueOnce({
            data: {
                invite: {
                    id: 'i1',
                    token: 'token123',
                    email: 'member@test.com',
                },
            },
        });

        fireEvent.submit(inviteForm.closest('form')!);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/companys/c1/invites', {
                email: 'member@test.com',
                role: 'MEMBER',
            });
        });
    });

    it('view companys -> view members -> change role', async () => {
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
            if (url.includes('/companys/c1/members/role')) {
                return Promise.resolve({
                    data: {
                        role: 'OWNER',
                    },
                });
            }
            if (url.includes('/companys/c1/members/primary-owner')) {
                return Promise.resolve({
                    data: {
                        primaryOwnerUserId: 'u1',
                        primaryOwnerName: 'Owner',
                        primaryOwnerEmail: 'owner@test.com',
                    },
                });
            }
            if (url.includes('/companys/c1/members') && !url.includes('/role') && !url.includes('/primary-owner')) {
                return Promise.resolve({
                    data: {
                        members: [
                            {
                                id: 'm1',
                                userId: 'u1',
                                role: 'OWNER',
                                name: 'Owner',
                                email: 'owner@test.com',
                            },
                            {
                                id: 'm2',
                                userId: 'u2',
                                role: 'MEMBER',
                                name: 'Member',
                                email: 'member@test.com',
                            },
                        ],
                        total: 2,
                        currentUserRole: 'OWNER',
                    },
                });
            }
            if (url.includes('/company/c1') && !url.includes('/members') && !url.includes('/public-info')) {
                return Promise.resolve({
                    data: {
                        id: 'c1',
                        name: 'Test Company',
                        logoUrl: 'https://example.com/logo.png',
                        description: 'Test Description',
                        is_public: false,
                        createdAt: new Date().toISOString(),
                    },
                });
            }
            if (url.includes('/friendships?status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        renderWithProviders(<CompanyPage />);

        await waitFor(() => {
            const companyElements = screen.getAllByText(/Test Company/i);
            expect(companyElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        await waitFor(() => {
            const ownerElements = screen.getAllByText(/Owner/i);
            expect(ownerElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        await waitFor(() => {
            const memberElements = screen.getAllByText(/Member/i);
            expect(memberElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        const memberEmailCell = screen.getAllByText(/member@test.com/i)[0];
        const memberRow = memberEmailCell.closest('tr') || memberEmailCell.closest('button') || memberEmailCell;
        fireEvent.click(memberRow!);

        await screen.findByText(/Alterar Papel/i);

        const roleSelect = screen.getAllByRole('combobox').pop();
        expect(roleSelect).toBeDefined();
        fireEvent.change(roleSelect!, {target: {value: 'ADMIN'}});

        httpMock.patch.mockResolvedValueOnce({
            data: {success: true},
        });

        const alterButton = screen.getByRole('button', { name: /Alterar/i });
        fireEvent.click(alterButton);

        const confirmButton = await screen.findByRole('button', { name: /Confirmar/i });
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/companys/c1/members/u2/role', {
                role: 'ADMIN',
            });
        }, { timeout: 5000 });
    });
});

