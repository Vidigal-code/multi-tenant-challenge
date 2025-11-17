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
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/invites/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'owner@test.com',
                        name: 'Owner',
                    },
                });
            }
            if (url.includes('/auth/account/primary-owner-companies')) {
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
            if (url.includes('/company/c1') && !url.includes('/members') && !url.includes('/role') && !url.includes('/select')) {
                return Promise.resolve({
                    data: {
                        id: 'c1',
                        name: 'Test Company',
                        logoUrl: 'https://example.com/logo.png',
                        description: 'Test Description',
                        is_public: false,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<DashboardPage />);

        // Wait for API call first
        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith('/auth/account/primary-owner-companies', {
                params: {page: 1, pageSize: 10},
            });
        }, { timeout: 5000 });

        // Then wait for the company name to appear
        await waitFor(() => {
            expect(screen.getByText(/Test Company/i)).toBeInTheDocument();
        }, { timeout: 5000 });

        httpMock.post.mockResolvedValueOnce({data: {success: true}});

        const selectButton = screen.getByText(/Ver empresa/i);
        fireEvent.click(selectButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/company/c1/select');
        });

        // Reset mocks and set up new implementation for CompanyPage
        jest.clearAllMocks();
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/invites/profile')) {
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
            return Promise.resolve({ data: {} });
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        renderWithProviders(<CompanyPage />);

        // Wait for company data to load
        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith('/company/c1');
        }, { timeout: 5000 });

        // Wait for company name to appear
        await waitFor(() => {
            const companyElements = screen.getAllByText(/Test Company/i);
            expect(companyElements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        await waitFor(() => {
            expect(screen.getByText(/Test Description/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        await waitFor(() => {
            const editButtons = screen.getAllByText(/editar empresa/i);
            expect(editButtons.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        // Get the first "Editar empresa" button (from the company list)
        const editButtons = screen.getAllByText(/editar empresa/i);
        const editButton = editButtons[0];
        expect(editButton).toBeDefined();
        
        // Mock the company data fetch for the edit modal
        httpMock.get.mockImplementationOnce((url: string) => {
            if (url === '/company/c1') {
                return Promise.resolve({
                    data: {
                        id: 'c1',
                        name: 'Test Company',
                        logoUrl: 'https://example.com/logo.png',
                        description: 'Test Description',
                        is_public: false,
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
        
        fireEvent.click(editButton);

        // Wait for the edit modal to open and form to be populated - DashboardPage uses "Nome da empresa" placeholder
        await waitFor(() => {
            const nameInput = screen.getByPlaceholderText(/nome da empresa/i);
            expect(nameInput).toBeInTheDocument();
            // Wait for the form to be populated with company data
            expect((nameInput as HTMLInputElement).value).toBe('Test Company');
        }, { timeout: 5000 });

        const nameInput = screen.getByPlaceholderText(/nome da empresa/i) as HTMLInputElement;
        // Clear the input first, then set new value
        fireEvent.change(nameInput, {
            target: {value: ''},
        });
        fireEvent.change(nameInput, {
            target: {value: 'Updated Company'},
        });
        
        // Wait for the value to be updated (controlled input)
        await waitFor(() => {
            const updatedInput = screen.getByPlaceholderText(/nome da empresa/i) as HTMLInputElement;
            expect(updatedInput.value).toBe('Updated Company');
        }, { timeout: 2000 });

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

        // Wait for the edit modal to close after successful update
        await waitFor(() => {
            const nameInput = screen.queryByPlaceholderText(/nome da empresa/i);
            expect(nameInput).not.toBeInTheDocument();
        }, { timeout: 5000 });

        // After updating, wait for the invite form to be visible on CompanyPage
        // The invite form is shown by default (showInvite starts as true)
        await waitFor(() => {
            // Look for the invite form input with placeholder "Email ou ID do usuário"
            const inviteInput = screen.getByPlaceholderText(/Email ou ID do usuário/i);
            expect(inviteInput).toBeInTheDocument();
        }, { timeout: 5000 });

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
            if (url.includes('/invites/profile') || url.includes('/auth/profile')) {
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
            if (url.includes('/friendships') && url.includes('status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            if (url.includes('/friendships') && !url.includes('status=')) {
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            if (url.includes('/company/c1/members') && url.includes('/role')) {
                return Promise.resolve({
                    data: {
                        role: 'OWNER',
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
                            {
                                id: 'm2',
                                userId: 'u2',
                                role: 'MEMBER',
                                name: 'Member',
                                email: 'member@test.com',
                                joinedAt: new Date().toISOString(),
                            },
                        ],
                        total: 2,
                        currentUserRole: 'OWNER',
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
            return Promise.resolve({ data: {} });
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        renderWithProviders(<CompanyPage />);

        // Wait for company data to load
        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith('/company/c1');
        }, { timeout: 5000 });

        // Wait for company name to appear
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

        // Click on a member to open the modal (members are clickable buttons/cards)
        const memberButtons = screen.getAllByRole('button').filter(btn => {
            const text = btn.textContent || '';
            return text.includes('member@test.com') || text.includes('Member');
        });
        const memberButton = memberButtons.find(btn => {
            const text = btn.textContent || '';
            return text.includes('member@test.com');
        }) || memberButtons[0];
        
        expect(memberButton).toBeDefined();
        fireEvent.click(memberButton!);

        // Wait for modal to open and find the role select
        await waitFor(() => {
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThan(0);
        }, { timeout: 5000 });

        // Find the role select in the modal - it should be the one with "Alterar Papel" label
        const roleSelectLabel = screen.getByText(/Alterar Papel/i);
        expect(roleSelectLabel).toBeInTheDocument();
        const roleSelectContainer = roleSelectLabel.closest('label')?.parentElement;
        expect(roleSelectContainer).toBeDefined();
        
        const roleSelect = roleSelectContainer?.querySelector('select') as HTMLSelectElement;
        expect(roleSelect).toBeDefined();
        expect(roleSelect.value).toBe('MEMBER'); // Current role is MEMBER
        
        // Change the select value to ADMIN
        fireEvent.change(roleSelect, {target: {value: 'ADMIN'}});
        
        // Wait for React to update the state and re-render
        await waitFor(() => {
            const updatedSelect = roleSelectContainer?.querySelector('select') as HTMLSelectElement;
            expect(updatedSelect.value).toBe('ADMIN');
        }, { timeout: 2000 });
        
        // Wait a bit more for React to process the state change
        await new Promise(resolve => setTimeout(resolve, 100));

        // Wait for the "Alterar" button to be enabled after changing the role
        // The button is in the same container as the select
        let saveButton: HTMLElement | undefined;
        await waitFor(() => {
            // Find the button in the same container as the select
            const buttons = roleSelectContainer?.querySelectorAll('button') || [];
            const alterarButton = Array.from(buttons).find(btn => {
                const text = btn.textContent || '';
                return /Alterar/i.test(text);
            });
            expect(alterarButton).toBeDefined();
            expect(alterarButton).not.toBeDisabled();
            saveButton = alterarButton as HTMLElement;
        }, { timeout: 5000 });

        httpMock.patch.mockResolvedValueOnce({
            data: {success: true},
        });

        // Click the enabled "Alterar" button next to the role select
        expect(saveButton).toBeDefined();
        expect(saveButton).not.toBeDisabled();
        fireEvent.click(saveButton!);

        // Wait for confirmation modal to appear
        await waitFor(() => {
            const confirmModal = screen.getByText(/Alterar papel do membro/i);
            expect(confirmModal).toBeInTheDocument();
        }, { timeout: 5000 });

        // Find and click the confirm button
        // The ConfirmModal uses a button with text "Confirmar" and onClick={onConfirm}
        await waitFor(() => {
            const confirmButtons = screen.getAllByRole('button');
            const confirmButton = confirmButtons.find(btn => {
                const text = btn.textContent || '';
                // The confirm button has red background and "Confirmar" text
                return /Confirmar/i.test(text) && 
                       (btn.className.includes('bg-red') || btn.className.includes('red'));
            });
            expect(confirmButton).toBeDefined();
            expect(confirmButton).not.toBeDisabled();
            fireEvent.click(confirmButton!);
        }, { timeout: 5000 });

        // Wait for the PATCH call to be made
        // Note: The endpoint uses /companys/ (plural) not /company/
        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/companys/c1/members/u2/role', {
                role: 'ADMIN',
            });
        }, { timeout: 5000 });
    });
});

