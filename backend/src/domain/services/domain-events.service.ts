export interface DomainEvent<TPayload = unknown> {
    name: string;
    payload: TPayload;
}

export interface DomainEventsService {
    publish<T>(event: DomainEvent<T>): Promise<void>;
}
