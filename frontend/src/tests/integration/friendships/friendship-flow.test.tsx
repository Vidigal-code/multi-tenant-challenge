import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../../store';
import FriendsPage from '../../../app/friends/page';
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
    useParams: () => ({}),
}));

jest.mock('../../../lib/realtime', () => ({
    subscribe: jest.fn(() => () => {}),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        FRIEND_REQUEST_SENT: 'friend.request.sent',
        FRIEND_REQUEST_ACCEPTED: 'friend.request.accepted',
        FRIEND_REMOVED: 'friend.removed',
    },
}));

const {http: httpMock} = jest.requireMock('../../../lib/http');

describe('Friendship Flow Integration', () => {
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

    it('complete flow: search -> send request -> accept -> send message -> remove', async () => {
        let pendingRequests: any[] = [];
        let acceptedFriendships: any[] = [];

        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'user1@test.com',
                        name: 'User 1',
                    },
                });
            }
            if (url.includes('/friendships?status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: acceptedFriendships,
                    },
                });
            }
            if (url.includes('/friendships?status=PENDING')) {
                return Promise.resolve({
                    data: {
                        data: pendingRequests,
                    },
                });
            }
            if (url.includes('/users/search')) {
                return Promise.resolve({
                    data: [
                        {
                            id: 'u2',
                            email: 'user2@test.com',
                            name: 'User 2',
                        },
                    ],
                });
            }
            return Promise.resolve({ data: {} });
        });

        httpMock.post.mockImplementation((url: string) => {
            if (url === '/friendships/request') {
                pendingRequests = [
                    {
                        id: 'f1',
                        requester: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                        addressee: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                        status: 'PENDING',
                        createdAt: new Date().toISOString(),
                    },
                ];
                return Promise.resolve({
                    data: {
                        friendship: {
                            id: 'f1',
                            requester: {id: 'u1', name: 'User 1'},
                            addressee: {id: 'u2', name: 'User 2'},
                            status: 'PENDING',
                        },
                    },
                });
            }
            if (url === '/friendships/f1/accept') {
                acceptedFriendships = [
                    {
                        id: 'f1',
                        requester: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                        addressee: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                        status: 'ACCEPTED',
                        createdAt: new Date().toISOString(),
                    },
                ];
                pendingRequests = [];
                return Promise.resolve({ data: { success: true } });
            }
            return Promise.resolve({ data: { success: true } });
        });

        renderWithProviders(<FriendsPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /Amigos/i})).toBeInTheDocument();
        }, { timeout: 5000 });

        const searchInput = screen.getByPlaceholderText(/Digite um nome ou email/i);
        fireEvent.change(searchInput, {target: {value: 'user2'}});

        const searchButtons = screen.getAllByText(/Buscar/i);
        const searchButton = searchButtons.find(btn => btn.tagName === 'BUTTON') || searchButtons[searchButtons.length - 1];
        fireEvent.click(searchButton);

        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith(
                '/users/search?q=user2',
            );
        }, { timeout: 5000 });

        const sendRequestButton = screen.getByRole('button', {name: /enviar solicitação/i});
        fireEvent.click(sendRequestButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/friendships/request', {
                email: 'user2@test.com',
            });
        });

        const requestsTab = screen.getAllByRole('button', { name: /Solicitações/i })[0];
        fireEvent.click(requestsTab);

        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith('/friendships?status=PENDING');
        }, { timeout: 5000 });

        await waitFor(() => {
            expect(screen.getByText(/User 2/i)).toBeInTheDocument();
        }, { timeout: 10000 });

        const acceptButton = screen.getByRole('button', {name: /aceitar/i});
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/friendships/f1/accept');
        });

        const friendsTab = screen.getAllByRole('button', { name: /Amigos/i })[0];
        fireEvent.click(friendsTab);

        await waitFor(() => {
            expect(screen.getByText(/User 2/i)).toBeInTheDocument();
        });

        const messagesTab = screen.getAllByRole('button', { name: /Enviar Mensagem/i }).find(btn => btn.closest('nav'))!;
        fireEvent.click(messagesTab);

        await waitFor(() => {
            expect(screen.getByText(/Envio Seletivo/i)).toBeInTheDocument();
        });

        const friendCheckbox = screen.getByLabelText(/User 2/i);
        fireEvent.click(friendCheckbox);

        const openMessageButton = screen.getByText(/Enviar Mensagem Seletiva/i);
        fireEvent.click(openMessageButton);

        fireEvent.change(screen.getByPlaceholderText(/Assunto/i), {
            target: {value: 'Hello'},
        });
        fireEvent.change(screen.getByPlaceholderText(/^Mensagem$/i), {
            target: {value: 'How are you?'},
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        const sendButton = screen.getAllByRole('button', {name: /enviar/i}).find(btn => btn.getAttribute('type') === 'submit')!;
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/notifications/friend', {
                friendEmail: 'user2@test.com',
                title: 'Hello',
                body: 'How are you?',
            });
        });

        const friendsTabAgain = screen.getAllByRole('button', { name: /Amigos/i })[0];
        fireEvent.click(friendsTabAgain);

        const removeButton = await screen.findByRole('button', {name: /remover/i});
        fireEvent.click(removeButton);

        await waitFor(() => {
            expect(screen.getByText(/confirmar/i)).toBeInTheDocument();
        });

        httpMock.delete.mockResolvedValueOnce({
            data: {success: true},
        });

        const confirmButton = screen.getByRole('button', {name: /confirmar/i});
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(httpMock.delete).toHaveBeenCalledWith('/friendships/f1');
        });
    });

    it('send global message to all friends', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'user1@test.com',
                        name: 'User 1',
                    },
                });
            }
            if (url.includes('/friendships?status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'f1',
                                requester: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                                addressee: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                                status: 'ACCEPTED',
                            },
                            {
                                id: 'f2',
                                requester: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                                addressee: {id: 'u3', name: 'User 3', email: 'user3@test.com'},
                                status: 'ACCEPTED',
                            },
                        ],
                    },
                });
            }
            if (url.includes('/friendships?status=PENDING')) {
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });

        renderWithProviders(<FriendsPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /Amigos/i})).toBeInTheDocument();
        }, { timeout: 5000 });

        await waitFor(() => {
            const friendsCount = screen.queryByText(/Amigos \(\d+\)/i);
            expect(friendsCount).toBeInTheDocument();
        }, { timeout: 5000 });

        const messagesTabs = screen.getAllByText(/Enviar Mensagem/i);
        const messagesTab = messagesTabs.find(btn => {
            const parent = btn.closest('div');
            return parent && parent.querySelector('.flex.border-b');
        }) || messagesTabs[0];
        fireEvent.click(messagesTab);

        await waitFor(() => {
            expect(screen.getByText(/Envio Global/i)).toBeInTheDocument();
        });

        const globalRadio = screen.getByLabelText(/Envio Global/i);
        fireEvent.click(globalRadio);

        await waitFor(() => {
            const sendMessageButton = screen.getByText(/Enviar Mensagem Global/i);
            expect(sendMessageButton).not.toBeDisabled();
        });

        const sendMessageButton = screen.getByText(/Enviar Mensagem Global/i);
        fireEvent.click(sendMessageButton);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Assunto/i)).toBeInTheDocument();
        }, { timeout: 5000 });
        fireEvent.change(screen.getByPlaceholderText(/Assunto/i), {
            target: {value: 'Announcement'},
        });
        fireEvent.change(screen.getByPlaceholderText(/Mensagem/i), {
            target: {value: 'Important message'},
        });

        httpMock.post
            .mockResolvedValueOnce({data: {success: true}})
            .mockResolvedValueOnce({data: {success: true}});

        const sendButtons = screen.getAllByRole('button', {name: /enviar/i});
        const sendButton = sendButtons.find(btn => btn.getAttribute('type') === 'submit') || sendButtons[sendButtons.length - 1];
        fireEvent.click(sendButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/notifications/friend', {
                friendEmail: 'user2@test.com',
                title: 'Announcement',
                body: 'Important message',
            });
            expect(httpMock.post).toHaveBeenCalledWith('/notifications/friend', {
                friendEmail: 'user3@test.com',
                title: 'Announcement',
                body: 'Important message',
            });
        });
    });
});

