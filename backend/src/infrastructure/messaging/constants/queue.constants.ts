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

/**
 * EN:
 * Dead Letter Queue paired with `INVITES_LIST_QUEUE`, ensuring faulty messages are
 * isolated for later inspection and reprocessing without blocking the main flow.
 *
 * PT:
 * Dead Letter Queue associada à `INVITES_LIST_QUEUE`, garantindo que mensagens com falha
 * fiquem isoladas para inspeção e reprocessamento sem bloquear o fluxo principal.
 */
export const DLQ_INVITES_LIST_QUEUE = "dlq.invites.list.requests";

/**
 * EN:
 * Queue dedicated to bulk invite actions (delete/reject), enabling asynchronous processing
 * for millions of invitations without blocking HTTP requests.
 *
 * PT:
 * Fila dedicada às ações em lote de convites (deletar/rejeitar), permitindo processamento
 * assíncrono para milhões de convites sem bloquear requisições HTTP.
 */
export const INVITES_BULK_QUEUE = "invites.bulk.requests";

/**
 * EN:
 * DLQ for bulk invite actions, preserving failed jobs for inspection or reprocessing.
 *
 * PT:
 * DLQ para ações em lote de convites, preservando jobs com falha para inspeção ou reprocessamento.
 */
export const DLQ_INVITES_BULK_QUEUE = "dlq.invites.bulk.requests";

