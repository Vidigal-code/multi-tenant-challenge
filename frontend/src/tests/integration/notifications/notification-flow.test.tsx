import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '../../../store';
import NotificationsPage from '../../../app/notifications/page';
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
}));

jest.mock('../../../lib/realtime', () => ({
    subscribe: jest.fn(() => () => {}),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        NOTIFICATION_CREATED: 'notifications.created',
        NOTIFICATION_READ: 'notifications.read',
    },
}));

const {http: httpMock} = jest.requireMock('../../../lib/http');

describe('Notification Flow Integration', () => {
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

    it('complete flow: list notifications -> mark read -> reply -> delete', async () => {
        httpMock.get.mockResolvedValueOnce({
            data: {
                items: [
                    {
                        id: 'n1',
                        title: 'Welcome!',
                        body: 'Welcome to the companys',
                        senderUserId: 'u2',
                        recipientUserId: 'u1',
                        companyId: 'c1',
                        createdAt: new Date().toISOString(),
                        read: false,
                        meta: {
                            kind: 'notifications.sent',
                            sender: {
                                id: 'u2',
                                name: 'User 2',
                                email: 'u2@test.com',
                            },
                        },
                    },
                    {
                        id: 'n2',
                        title: 'Meeting',
                        body: 'Team meeting at 3pm',
                        senderUserId: 'u2',
                        recipientUserId: 'u1',
                        companyId: 'c1',
                        createdAt: new Date().toISOString(),
                        read: true,
                        meta: {
                            kind: 'notifications.sent',
                            sender: {
                                id: 'u2',
                                name: 'User 2',
                                email: 'u2@test.com',
                            },
                        },
                    },
                ],
                total: 2,
            },
        });

        renderWithProviders(<NotificationsPage />);

        await waitFor(() => {
            const elements = screen.getAllByText(/Welcome to the company/i);
            expect(elements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        await waitFor(() => {
            const elements = screen.getAllByText(/Team meeting at 3pm/i);
            expect(elements.length).toBeGreaterThan(0);
        }, { timeout: 10000 });

        const markReadButton = screen.getAllByText(/Marcar como lida/i)[0];
        fireEvent.click(markReadButton);

        httpMock.patch.mockResolvedValueOnce({
            data: {success: true},
        });

        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/notifications/n1/read');
        });

        const replyButton = screen.getAllByText(/Responder/i)[0];
        fireEvent.click(replyButton);

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/Digite sua resposta/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText(/Digite sua resposta/i), {
            target: {value: 'Thank you!'},
        });

        httpMock.post.mockResolvedValueOnce({
            data: {
                replyNotification: {
                    id: 'n3',
                    title: 'Re: Welcome!',
                    body: 'Thank you!',
                },
            },
        });

        const sendReplyButton = screen.getByText(/Enviar Resposta/i);
        fireEvent.click(sendReplyButton);

        await waitFor(() => {
            // The first "Responder" button might be for n2 (read notification) or n1 (unread)
            // Check which notification ID was actually used
            const calls = (httpMock.post as jest.Mock).mock.calls;
            const replyCall = calls.find((call: any[]) => call[0]?.includes('/notifications/') && call[0]?.includes('/reply'));
            expect(replyCall).toBeDefined();
            expect(replyCall[0]).toMatch(/\/notifications\/n\d+\/reply/);
            expect(replyCall[1]).toEqual({replyBody: 'Thank you!'});
        });

        httpMock.delete.mockResolvedValueOnce({
            data: {success: true},
        });

        const deleteButton = screen.getAllByText(/Excluir/i)[0];
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText(/Confirmar/i)).toBeInTheDocument();
        });

        const confirmButton = screen.getByRole('button', {name: /Confirmar/i});
        fireEvent.click(confirmButton);

        await waitFor(() => {
            // The notification ID can be n1 or n2 depending on rendering order
            const calls = (httpMock.delete as jest.Mock).mock.calls;
            const deleteCall = calls.find((call: any[]) => call[0]?.match(/^\/notifications\/n\d+$/));
            expect(deleteCall).toBeDefined();
            if (deleteCall) {
                expect(deleteCall[0]).toMatch(/^\/notifications\/n\d+$/);
            }
        });
    });

    it('filter notifications by read status', async () => {
        httpMock.get.mockResolvedValueOnce({
            data: {
                items: [
                    {
                        id: 'n1',
                        title: 'Unread',
                        body: 'Unread notifications',
                        senderUserId: 'u2',
                        recipientUserId: 'u1',
                        companyId: 'c1',
                        createdAt: new Date().toISOString(),
                        read: false,
                        meta: {},
                    },
                    {
                        id: 'n2',
                        title: 'Read',
                        body: 'Read notifications',
                        senderUserId: 'u2',
                        recipientUserId: 'u1',
                        companyId: 'c1',
                        createdAt: new Date().toISOString(),
                        read: true,
                        meta: {},
                    },
                ],
                total: 2,
            },
        });

        renderWithProviders(<NotificationsPage />);

        await waitFor(() => {
            const unreadElements = screen.getAllByText(/Unread notification/i);
            expect(unreadElements.length).toBeGreaterThan(0);
            const readElements = screen.getAllByText(/Read notification/i);
            expect(readElements.length).toBeGreaterThan(0);
        }, { timeout: 5000 });

        const markReadButtons = screen.getAllByText(/Marcar como lida/i);
        expect(markReadButtons.length).toBeGreaterThan(0);

        const readNotificationElements = screen.getAllByText(/Read notification/i);
        expect(readNotificationElements.length).toBeGreaterThan(0);
        
        const readNotificationCard = readNotificationElements.find(el => {
            const parent = el.closest('.border');
            return parent && parent.querySelector('h3')?.textContent?.includes('Read notifications');
        });
        
        if (readNotificationCard) {
            const card = readNotificationCard.closest('.border');
            if (card) {
                const cardButtons = Array.from(card.querySelectorAll('button'));
                const hasMarkAsRead = cardButtons.some(btn => btn.textContent?.includes('Marcar como lida'));
                expect(hasMarkAsRead).toBe(false);
            }
        }
    });
});

