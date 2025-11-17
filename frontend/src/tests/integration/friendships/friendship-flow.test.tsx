import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../../store';
import FriendsPage from '../../../app/friends/page';
import {http} from '../../../lib/http';
import {queryKeys} from '../../../lib/queryKeys';

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
    useParams: () => ({ id: undefined }),
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
        let pendingRequestsCallCount = 0;
        let shouldReturnRequest = false;
        
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/invites/profile') || url.includes('/auth/profile')) {
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
                        data: [],
                    },
                });
            }
            if (url.includes('/friendships?status=PENDING')) {
                pendingRequestsCallCount++;
                // Return empty array on first call (initial load), then return the request after refetch
                if (shouldReturnRequest || pendingRequestsCallCount > 1) {
                    return Promise.resolve({
                        data: {
                            data: [
                                {
                                    id: 'f2',
                                    requester: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                                    addressee: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                                    status: 'PENDING',
                                    createdAt: new Date().toISOString(),
                                },
                            ],
                        },
                    });
                }
                // Return empty array on first call
                return Promise.resolve({
                    data: {
                        data: [],
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

        renderWithProviders(<FriendsPage />);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /Amigos/i})).toBeInTheDocument();
        }, { timeout: 5000 });

        const searchInput = screen.getByPlaceholderText(/Digite um nome ou email/i);
        fireEvent.change(searchInput, {target: {value: 'user2'}});

        const searchButtons = screen.getAllByText(/Buscar/i);
        const searchButton = searchButtons.find(btn => btn.tagName === 'BUTTON') || searchButtons[searchButtons.length - 1];
        fireEvent.click(searchButton);

        // Wait for search API call and results to appear
        await waitFor(() => {
            expect(httpMock.get).toHaveBeenCalledWith(
                expect.stringContaining('/users/search'),
            );
        }, { timeout: 5000 });

        // Wait for search results to appear - the component filters out current user
        // So User 2 should appear if current user is User 1
        await waitFor(() => {
            const user2Name = screen.queryByText(/User 2/i);
            const user2Email = screen.queryByText(/user2@test.com/i);
            const sendRequestButtons = screen.queryAllByRole('button', {name: /enviar solicitação/i});
            // Either the name/email appears OR the send request button appears (which means results are shown)
            expect(user2Name || user2Email || sendRequestButtons.length > 0).toBeTruthy();
        }, { timeout: 10000 });

        httpMock.post.mockResolvedValueOnce({
            data: {
                friendship: {
                    id: 'f1',
                    requester: {id: 'u1', name: 'User 1'},
                    addressee: {id: 'u2', name: 'User 2'},
                    status: 'PENDING',
                },
            },
        });

        // Find the send request button - it should be in the search results
        const sendRequestButtons = screen.getAllByRole('button', {name: /enviar solicitação/i});
        const sendRequestButton = sendRequestButtons[0];
        expect(sendRequestButton).toBeDefined();
        fireEvent.click(sendRequestButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/friendships/request', {
                email: 'user2@test.com',
            });
        });

        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/friendships?status=PENDING')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'f1',
                                requester: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                                addressee: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                                status: 'PENDING',
                                createdAt: new Date().toISOString(),
                            },
                        ],
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
            if (url.includes('/invites/profile') || url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'user1@test.com',
                        name: 'User 1',
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

        // After sending a request, the component might show it differently
        // The "Solicitações Pendentes" tab shows requests received by current user, not sent
        // So we won't see the request we just sent in that tab
        // Instead, let's verify the request was sent and move on to accepting it
        // (In a real scenario, User 2 would see the request, but we're testing as User 1)
        
        // For now, just verify the request was sent successfully
        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/friendships/request', {
                email: 'user2@test.com',
            });
        }, { timeout: 5000 });
        
        // Note: The pending requests tab shows requests received, not sent
        // So User 1 won't see the request they sent to User 2
        // For the test to work, we need to simulate User 2 sending a request to User 1
        // The mock is already set up to return the request on subsequent calls
        // We need to invalidate the query cache to force a refetch
        // Since we can't easily access the query client, we'll wait for React Query to refetch
        // React Query with staleTime: 0 should refetch when the query is accessed again
        
        const requestsTab = screen.getByText(/Solicitações/i);
        fireEvent.click(requestsTab);
        
        // Update the mock to return the request on the next call
        shouldReturnRequest = true;
        
        // Remove the query from cache and force a fresh fetch
        queryClient.removeQueries({ queryKey: queryKeys.friendRequests() });
        
        // Force a refetch of the friend requests query
        // This ensures React Query will fetch with the new mock data (request from User 2)
        await queryClient.refetchQueries({ queryKey: queryKeys.friendRequests() });

        // Wait for React Query to refetch and process the response
        await waitFor(() => {
            // Check that the API was called with PENDING status after refetch
            const pendingCalls = (httpMock.get as jest.Mock).mock.calls.filter((call: any[]) => 
                call[0]?.includes('/friendships?status=PENDING')
            );
            // Should have at least 2 calls: initial load + refetch
            expect(pendingCalls.length).toBeGreaterThanOrEqual(2);
        }, { timeout: 5000 });
        
        // Wait for React Query to finish processing
        await waitFor(() => {
            const queryState = queryClient.getQueryState(queryKeys.friendRequests());
            return queryState && !queryState.isFetching;
        }, { timeout: 5000 });
        
        // Wait for React Query to process the response and update the UI
        // The component filters requests where addressee.id === currentUserId
        // The mock returns a request where addressee.id is u1, so it should appear
        await waitFor(() => {
            // First check if the tab count updated (most reliable indicator)
            const requestsTabText = screen.queryByText(/Solicitações Pendentes/i);
            if (requestsTabText) {
                const match = requestsTabText.textContent?.match(/\((\d+)\)/);
                if (match && parseInt(match[1]) > 0) {
                    return; // Tab shows requests count > 0
                }
            }
            
            // Check for accept button which appears when requests are shown
            const acceptButtons = screen.queryAllByRole('button', {name: /aceitar/i});
            if (acceptButtons.length > 0) {
                return; // Found accept buttons, requests are rendered
            }
            
            // Also check for requester name or email (User 2 is the requester)
            const user2Name = screen.queryByText(/User 2/i);
            const user2Email = screen.queryByText(/user2@test.com/i);
            if (user2Name || user2Email) {
                return; // Found user info, requests are rendered
            }
            
            // If we get here, requests aren't rendered yet
            throw new Error('Pending requests not found');
        }, { timeout: 10000 });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        // Find the accept button - there might be multiple, so get the first one
        const acceptButtons = screen.getAllByRole('button', {name: /aceitar/i});
        expect(acceptButtons.length).toBeGreaterThan(0);
        const acceptButton = acceptButtons[0];
        fireEvent.click(acceptButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/friendships/f2/accept');
        });

        // Update mock to return accepted friendship and empty pending requests
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/friendships?status=ACCEPTED')) {
                return Promise.resolve({
                    data: {
                        data: [
                            {
                                id: 'f2',
                                requester: {id: 'u2', name: 'User 2', email: 'user2@test.com'},
                                addressee: {id: 'u1', name: 'User 1', email: 'user1@test.com'},
                                status: 'ACCEPTED',
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    },
                });
            }
            if (url.includes('/friendships?status=PENDING')) {
                // After accepting, pending requests should be empty
                return Promise.resolve({
                    data: {
                        data: [],
                    },
                });
            }
            if (url.includes('/invites/profile') || url.includes('/auth/profile')) {
                return Promise.resolve({
                    data: {
                        id: 'u1',
                        email: 'user1@test.com',
                        name: 'User 1',
                    },
                });
            }
            return Promise.resolve({ data: {} });
        });
        
        // Invalidate queries to force refetch after accepting
        await queryClient.invalidateQueries({ queryKey: queryKeys.friendships('ACCEPTED') });
        await queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests() });

        // Find the friends tab - there might be multiple "Amigos" texts, so find the tab button
        const friendsTabButtons = screen.getAllByRole('button').filter(btn => 
            btn.textContent?.includes('Amigos')
        );
        expect(friendsTabButtons.length).toBeGreaterThan(0);
        const friendsTab = friendsTabButtons[0];
        fireEvent.click(friendsTab);

        await waitFor(() => {
            expect(screen.getByText(/User 2/i)).toBeInTheDocument();
        });

        // Find the messages tab button - there might be multiple "Enviar Mensagem" texts
        const messagesTabButtons = screen.getAllByRole('button').filter(btn => 
            btn.textContent?.includes('Enviar Mensagem')
        );
        expect(messagesTabButtons.length).toBeGreaterThan(0);
        // Get the tab button (not the action button in the friend list)
        const messagesTab = messagesTabButtons.find(btn => {
            // Tab buttons are in the nav, action buttons are in friend cards
            const parent = btn.closest('nav');
            return parent !== null;
        }) || messagesTabButtons[0];
        fireEvent.click(messagesTab);

        await waitFor(() => {
            expect(screen.getByText(/Envio Seletivo/i)).toBeInTheDocument();
        });

        const friendCheckbox = screen.getByLabelText(/User 2/i);
        fireEvent.click(friendCheckbox);

        // Click the "Enviar Mensagem Seletiva" button to open the modal
        const sendSelectiveButton = screen.getByText(/Enviar Mensagem Seletiva/i);
        expect(sendSelectiveButton).not.toBeDisabled();
        fireEvent.click(sendSelectiveButton);

        // Wait for the modal to open and form inputs to be available
        await waitFor(() => {
            const assuntoInput = screen.getByPlaceholderText(/Assunto/i);
            expect(assuntoInput).toBeInTheDocument();
        }, { timeout: 5000 });

        fireEvent.change(screen.getByPlaceholderText(/Assunto/i), {
            target: {value: 'Hello'},
        });
        fireEvent.change(screen.getByPlaceholderText(/Mensagem/i), {
            target: {value: 'How are you?'},
        });

        httpMock.post.mockResolvedValueOnce({
            data: {success: true},
        });

        // Find the send button in the modal form - submit the form directly
        const form = screen.getByPlaceholderText(/Assunto/i).closest('form');
        expect(form).toBeDefined();
        fireEvent.submit(form!);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/notifications/friend', {
                friendEmail: 'user2@test.com',
                title: 'Hello',
                body: 'How are you?',
            });
        });

        // Find the remove button - go back to friends tab first
        const friendsTabButtons2 = screen.getAllByRole('button').filter(btn => 
            btn.textContent?.includes('Amigos')
        );
        const friendsTab2 = friendsTabButtons2.find(btn => {
            const parent = btn.closest('nav');
            return parent !== null;
        }) || friendsTabButtons2[0];
        fireEvent.click(friendsTab2);

        // Wait for User 2 to appear in friends list
        await waitFor(() => {
            expect(screen.getByText(/User 2/i)).toBeInTheDocument();
        });

        // Find the remove button for User 2
        const removeButtons = screen.getAllByRole('button').filter(btn => {
            const text = btn.textContent || '';
            return /remover/i.test(text);
        });
        expect(removeButtons.length).toBeGreaterThan(0);
        const removeButton = removeButtons[0];
        fireEvent.click(removeButton);

        await waitFor(() => {
            const confirmButtons = screen.getAllByRole('button').filter(btn => {
                const text = btn.textContent || '';
                return /confirmar/i.test(text);
            });
            expect(confirmButtons.length).toBeGreaterThan(0);
        }, { timeout: 5000 });

        httpMock.delete.mockResolvedValueOnce({
            data: {success: true},
        });

        const confirmButtons = screen.getAllByRole('button').filter(btn => {
            const text = btn.textContent || '';
            return /confirmar/i.test(text);
        });
        expect(confirmButtons.length).toBeGreaterThan(0);
        const confirmButton = confirmButtons.find(btn => {
            const parent = btn.closest('[role="dialog"]') || btn.closest('.fixed');
            return parent !== null;
        }) || confirmButtons[0];
        fireEvent.click(confirmButton);

        await waitFor(() => {
            expect(httpMock.delete).toHaveBeenCalledWith('/friendships/f2');
        });
    });

    it('send global message to all friends', async () => {
        httpMock.get.mockImplementation((url: string) => {
            if (url.includes('/invites/profile') || url.includes('/auth/profile')) {
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

        // Global message sends to all friends (user2@test.com and user3@test.com)
        // Check that it was called with the correct structure for both friends
        await waitFor(() => {
            const calls = (httpMock.post as jest.Mock).mock.calls;
            const friendCalls = calls.filter((call: any[]) => 
                call[0] === '/notifications/friend' &&
                call[1]?.title === 'Announcement' &&
                call[1]?.body === 'Important message'
            );
            expect(friendCalls.length).toBeGreaterThanOrEqual(2);
            // Should send to user2@test.com and user3@test.com (not user1@test.com)
            const friendEmails = friendCalls.map((call: any[]) => call[1]?.friendEmail);
            expect(friendEmails).toContain('user2@test.com');
            expect(friendEmails).toContain('user3@test.com');
            expect(friendEmails).not.toContain('user1@test.com');
        });
    });
});

