import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../../../store';
import NotificationsPage from "../../../app/notifications/page";
import { http } from '../../../lib/http';

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
    subscribe: jest.fn(() => () => { }),
    whenReady: jest.fn(() => Promise.resolve()),
    RT_EVENTS: {
        NOTIFICATION_CREATED: 'notifications.created',
        NOTIFICATION_READ: 'notifications.read',
    },
}));


const { http: httpMock } = jest.requireMock('../../../lib/http');

describe('Notification Flow Integration', () => {
    let queryClient: QueryClient;

    beforeAll(() => {
        jest.setTimeout(30000);
    });

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false, staleTime: 0 },
                mutations: { retry: false },
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

    type MockHandler = (payload?: any) => Promise<{ data: any }> | { data: any };

    interface MockListingOptions {
        jobId?: string;
        extraPostMocks?: Record<string, MockHandler>;
        extraGetMocks?: Record<string, () => Promise<{ data: any }> | { data: any }>;
    }

    const setupNotificationListingMocks = (
        items: Array<Record<string, any>>,
        options: MockListingOptions = {}
    ) => {
        const jobId = options.jobId ?? 'test-job-id';

        httpMock.post.mockImplementation((url: string, payload?: any) => {
            if (url === '/notifications/listing') {
                return Promise.resolve({ data: { jobId } });
            }

            const handler = options.extraPostMocks?.[url];
            if (handler) {
                return Promise.resolve(handler(payload));
            }

            return Promise.resolve({ data: {} });
        });

        httpMock.get.mockImplementation((url: string) => {
            if (url === `/notifications/listing/${jobId}`) {
                return Promise.resolve({
            data: {
                        items,
                        total: items.length,
                        status: 'completed',
                        done: true,
                        jobId,
                        nextCursor: null,
                        error: undefined,
                    },
                });
            }

            if (url.startsWith('/friendships')) {
                return Promise.resolve({ data: [] });
            }

            const handler = options.extraGetMocks?.[url];
            if (handler) {
                return Promise.resolve(handler());
            }

            return Promise.resolve({ data: {} });
        });
    };

    it('complete flow: list notifications -> mark read -> reply', async () => {
        setupNotificationListingMocks(
            [
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
            {
                jobId: 'job-complete-flow',
                extraPostMocks: {
                    '/notifications/n1/reply': (payload) => ({
                        data: {
                            replyNotification: {
                                id: 'n3',
                                title: 'Re: Welcome!',
                                body: payload?.replyBody ?? 'Thank you!',
                            },
            },
                    }),
                },
            }
        );

        renderWithProviders(<NotificationsPage />);

        const unreadNotificationCard = await screen.findByTestId('notification-card-n1');
        await screen.findByTestId('notification-card-n2');

        const unreadNotificationCardBody = await screen.findByTestId('notification-card-body-n1');

        httpMock.patch.mockResolvedValueOnce({
            data: { success: true },
        });

        fireEvent.click(unreadNotificationCardBody);

        await waitFor(() => {
            expect(httpMock.patch).toHaveBeenCalledWith('/notifications/n1/read');
        });

        const firstNotificationCard = unreadNotificationCard;
        const replyButton = await screen.findByRole('button', { name: /Responder/i });
        fireEvent.click(replyButton);

        const replyTextarea = await screen.findByPlaceholderText(/Escreva sua resposta/i);

        fireEvent.change(replyTextarea, {
            target: { value: 'Thank you!' },
        });

        const sendReplyButton = await screen.findByText(/Enviar Resposta/i);
        fireEvent.click(sendReplyButton);

        await waitFor(() => {
            expect(httpMock.post).toHaveBeenCalledWith('/notifications/n1/reply', {
                replyBody: 'Thank you!',
            });
        });

        httpMock.delete.mockResolvedValueOnce({
            data: { success: true },
        });

    });

    it('filter notifications by read status', async () => {
        setupNotificationListingMocks(
            [
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
            { jobId: 'job-filter-flow' }
        );

        renderWithProviders(<NotificationsPage />);

        const unreadNotificationCard = await screen.findByTestId('notification-card-n1');
        const readNotificationCard = await screen.findByTestId('notification-card-n2');

        expect(unreadNotificationCard).toHaveAttribute('data-read', 'false');
        expect(readNotificationCard).toHaveAttribute('data-read', 'true');

        expect(within(unreadNotificationCard).queryByTitle(/Marcar como lida/i)).not.toBeNull();
        expect(within(readNotificationCard).queryByTitle(/Marcar como lida/i)).toBeNull();
    });
});

