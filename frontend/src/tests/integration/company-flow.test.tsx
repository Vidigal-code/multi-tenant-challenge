import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../store';
import DashboardPage from '../../app/dashboard/page';
import CompanyPage from '../../app/company/[id]/page';
import {http} from '../../lib/http';

jest.mock('../../lib/http', () => ({
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

jest.mock('../../lib/realtime', () => ({
    subscribe: jest.fn(() => () => {}),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        COMPANY_UPDATED: 'company.updated',
        MEMBER_JOINED: 'member.joined',
        MEMBER_LEFT: 'member.left',
    },
}));

const {http: httpMock} = jest.requireMock('../../lib/http');

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

    it('complete flow: list companies -> select -> view -> edit -> invite', async () => {
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
            if (url.includes('/companies')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'c1',
                                props: {
                                    id: 'c1',
                                    name: 'Test Company',
                                    logoUrl: 'https://example.com/logo.png',
                                },
                                name: 'Test Company',
                                logoUrl: 'https://example.com/logo.png',
                            },
                        ],
                        total: 1,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.post.mockResolvedValueOnce({data: {success: true}});

        const selectButton = screen.getByText(/Select/i);
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
            if (url.includes('/company/c1/members/role')) {
                return Promise.resolve({
                    data: {
                        role: 'OWNER',
                    },
                });
            }
            if (url.includes('/company/c1/members/primary-owner')) {
                return Promise.resolve({
                    data: {
                        primaryOwnerUserId: 'u1',
                        primaryOwnerName: 'Owner',
                        primaryOwnerEmail: 'owner@test.com',
                    },
                });
            }
            if (url.includes('/company/c1/members') && !url.includes('/role') && !url.includes('/primary-owner')) {
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
            expect(screen.getByText(/editar empresa/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        const editButton = screen.getByText(/editar empresa/i);
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
            expect(screen.getByText(/Invite/i)).toBeInTheDocument();
        });

        const inviteForm = screen.getByPlaceholderText(/Email/i);
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
            expect(httpMock.post).toHaveBeenCalledWith('/company/c1/invite', {
                email: 'member@test.com',
                role: 'MEMBER',
            });
        });
    });

    it('view company -> view members -> change role', async () => {
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
            if (url.includes('/company/c1/members/role')) {
                return Promise.resolve({
                    data: {
                        role: 'OWNER',
                    },
                });
            }
            if (url.includes('/company/c1/members/primary-owner')) {
                return Promise.resolve({
                    data: {
                        primaryOwnerUserId: 'u1',
                        primaryOwnerName: 'Owner',
                        primaryOwnerEmail: 'owner@test.com',
                    },
                });
            }
            if (url.includes('/company/c1/members') && !url.includes('/role') && !url.includes('/primary-owner')) {
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

        const editButtons = screen.getAllByText(/Edit/i);
        const memberEditButton = editButtons.find(btn => {
            const row = btn.closest('tr');
            return row && row.textContent?.includes('member@test.com');
        });
        
        expect(memberEditButton).toBeInTheDocument();
        fireEvent.click(memberEditButton!);

        await waitFor(() => {
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThan(0);
        });

        const roleSelect = screen.getAllByRole('combobox').find(select => {
            const row = select.closest('tr');
            return row && row.textContent?.includes('member@test.com');
        });
        
        expect(roleSelect).toBeInTheDocument();
        fireEvent.change(roleSelect!, {target: {value: 'ADMIN'}});

        httpMock.patch.mockResolvedValueOnce({
            data: {success: true},
        });

        const saveButton = screen.getByText(/Save/i);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/company/c1/members/u2/role', {
                role: 'ADMIN',
            });
        }, { timeout: 5000 });
    });
});

