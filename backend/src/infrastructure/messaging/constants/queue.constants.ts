/**
 * EN:
 * Queue identifiers dedicated to invite listing jobs, allowing the API layer
 * to enqueue heavy listing tasks and workers to consume them consistently.
 *
 * PT:
 * Identificadores de filas dedicadas aos jobs de listagem de convites, permitindo
 * que a camada de API enfileire tarefas pesadas enquanto os workers consomem de forma consistente.
 */
export const INVITES_LIST_QUEUE = "invites.list.requests";

export const DLQ_INVITES_LIST_QUEUE = "dlq.invites.list.requests";

export const COMPANIES_LIST_QUEUE = "companies.list.requests";
export const DLQ_COMPANIES_LIST_QUEUE = "dlq.companies.list.requests";

export const INVITES_BULK_QUEUE = "invites.bulk.requests";
export const DLQ_INVITES_BULK_QUEUE = "dlq.invites.bulk.requests";

export const NOTIFICATIONS_LIST_QUEUE = "notifications.list.requests";
export const DLQ_NOTIFICATIONS_LIST_QUEUE = "dlq.notifications.list.requests";

export const NOTIFICATIONS_DELETE_QUEUE = "notifications.delete.requests";
export const DLQ_NOTIFICATIONS_DELETE_QUEUE = "dlq.notifications.delete.requests";

export const FRIENDSHIPS_LIST_QUEUE = "friendships.list.requests";
export const DLQ_FRIENDSHIPS_LIST_QUEUE = "dlq.friendships.list.requests";

export const USER_SEARCH_QUEUE = "users.search.requests";
export const DLQ_USER_SEARCH_QUEUE = "dlq.users.search.requests";
