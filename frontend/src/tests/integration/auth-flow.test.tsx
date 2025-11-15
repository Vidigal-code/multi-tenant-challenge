import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../store';
import LoginPage from '../../app/login/page';
import SignupPage from '../../app/signup/page';
import DashboardPage from '../../app/dashboard/page';
import {http} from '../../lib/http';
import {ThemeProvider} from '../../contexts/ThemeContext';

jest.mock('../../lib/http', () => ({
    http: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
    redirect: jest.fn(),
}));

const {http: httpMock} = jest.requireMock('../../lib/http');

describe('Auth Flow Integration', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {retry: false},
                mutations: {retry: false},
            },
        });
        jest.clearAllMocks();
    });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <ThemeProvider>
                <ReduxProvider store={store}>
                    <QueryClientProvider client={queryClient}>
                        {component}
                    </QueryClientProvider>
                </ReduxProvider>
            </ThemeProvider>
        );
    };

    it('complete flow: signup -> login -> dashboard', async () => {
        httpMock.post.mockResolvedValueOnce({
            data: {
                user: {
                    id: 'u1',
                    email: 'user@test.com',
                    name: 'Test User',
                },
            },
        });

        renderWithProviders(<SignupPage />);

        fireEvent.change(screen.getByPlaceholderText(/nome/i), {
            target: {value: 'Test User'},
        });
        const signupEmailInputs = screen.getAllByPlaceholderText(/email/i);
        const signupEmailInput = signupEmailInputs.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Registrar');
        }) || signupEmailInputs[0];
        fireEvent.change(signupEmailInput, {
            target: {value: 'user@test.com'},
        });
        const signupPasswordInputs = screen.getAllByPlaceholderText(/senha/i);
        const signupPasswordInput = signupPasswordInputs.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Registrar');
        }) || signupPasswordInputs[0];
        fireEvent.change(signupPasswordInput, {
            target: {value: 'password123'},
        });

        const signupForm = signupEmailInput.closest('form');
        expect(signupForm).toBeInTheDocument();
        fireEvent.submit(signupForm!);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/auth/signup', {
                email: 'user@test.com',
                name: 'Test User',
                password: 'password123',
            });
        });

        httpMock.post.mockResolvedValueOnce({
            data: {
                user: {
                    id: 'u1',
                    email: 'user@test.com',
                    name: 'Test User',
                },
            },
        });

        renderWithProviders(<LoginPage />);

        const loginEmailInputs = screen.getAllByPlaceholderText(/email/i);
        const loginEmailInput = loginEmailInputs.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Entrar');
        }) || loginEmailInputs[loginEmailInputs.length - 1];
        
        fireEvent.change(loginEmailInput, {
            target: {value: 'user@test.com'},
        });
        const loginPasswordInputs = screen.getAllByPlaceholderText(/senha/i);
        const loginPasswordInput = loginPasswordInputs.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Entrar');
        }) || loginPasswordInputs[loginPasswordInputs.length - 1];
        fireEvent.change(loginPasswordInput, {
            target: {value: 'password123'},
        });

        const loginForm = loginEmailInput.closest('form');
        expect(loginForm).toBeInTheDocument();
        fireEvent.submit(loginForm!);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/auth/login', {
                email: 'user@test.com',
                password: 'password123',
            });
        });

        httpMock.get.mockResolvedValueOnce({
            data: {
                id: 'u1',
                email: 'user@test.com',
                name: 'Test User',
            },
        });

        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/companies')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'c1',
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
            expect(httpMock.get).toHaveBeenCalledWith('/companies', {
                params: {page: 1, pageSize: 10},
            });
        });

        expect(await screen.findByText(/Test Company/i)).toBeInTheDocument();
    });

    it('login with invalid credentials shows error', async () => {
        httpMock.post.mockRejectedValueOnce({
            response: {
                status: 401,
                data: {code: 'INVALID_CREDENTIALS', message: 'INVALID_CREDENTIALS'},
            },
        });

        renderWithProviders(<LoginPage />);

        const loginEmailInputs2 = screen.getAllByPlaceholderText(/email/i);
        const loginEmailInput2 = loginEmailInputs2.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Entrar');
        }) || loginEmailInputs2[loginEmailInputs2.length - 1];
        
        fireEvent.change(loginEmailInput2, {
            target: {value: 'wrong@test.com'},
        });
        const loginPasswordInputs2 = screen.getAllByPlaceholderText(/senha/i);
        const loginPasswordInput2 = loginPasswordInputs2.find(input => {
            const form = input.closest('form');
            return form && form.querySelector('button[type="submit"]')?.textContent?.includes('Entrar');
        }) || loginPasswordInputs2[loginPasswordInputs2.length - 1];
        fireEvent.change(loginPasswordInput2, {
            target: {value: 'wrongpassword'},
        });

        const loginForm2 = loginEmailInput2.closest('form');
        expect(loginForm2).toBeInTheDocument();
        fireEvent.submit(loginForm2!);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/auth/login', {
                email: 'wrong@test.com',
                password: 'wrongpassword',
            });
        });

        await waitFor(() => {
            const errorElement = screen.queryByText(/Falha no login/i) || 
                                 screen.queryByText(/Invalid credentials/i) ||
                                 screen.queryByText(/credenciais inválidas/i) ||
                                 screen.queryByText(/Invalid credentials\./i);
            expect(errorElement).toBeInTheDocument();
        }, { timeout: 10000 });
    });
});

