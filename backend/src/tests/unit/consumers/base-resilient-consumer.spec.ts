import {BaseResilientConsumer, ResilientConsumerOptions} from "@interfaces/consumers/base.resilient.consumer";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {ConfigService} from "@nestjs/config";

// Mock ioredis at module level
jest.mock("ioredis", () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn(),
        set: jest.fn(),
        ttl: jest.fn(),
    }));
});

/**
 * EN -
 * Unit tests for BaseResilientConsumer following TDD principles.
 * 
 * Tests cover:
 * - Queue initialization with DLQ configuration
 * - Message parsing and validation
 * - Deduplication using Redis
 * - Retry logic with exponential backoff
 * - Dead Letter Queue routing for failed messages
 * - Prefetch configuration
 * - Message acknowledgment
 * 
 * PT -
 * Testes unitários para BaseResilientConsumer seguindo princípios TDD.
 * 
 * Testes cobrem:
 * - Inicialização de fila com configuração de DLQ
 * - Parsing e validação de mensagens
 * - Desduplicação usando Redis
 * - Lógica de retry com backoff exponencial
 * - Roteamento para Dead Letter Queue para mensagens falhadas
 * - Configuração de prefetch
 * - Confirmação de mensagens
 */
describe("BaseResilientConsumer", () => {
    let mockRabbit: jest.Mocked<RabbitMQService>;
    let mockConfig: jest.Mocked<ConfigService>;
    let mockRedis: any;
    let mockChannel: any;
    let options: ResilientConsumerOptions;

    /**
     * EN -
     * Test implementation of BaseResilientConsumer for testing purposes.
     * 
     * PT -
     * Implementação de teste de BaseResilientConsumer para fins de teste.
     */
    class TestConsumer extends BaseResilientConsumer<any> {
        async process(payload: any): Promise<void> {
            // Test implementation
        }

        protected dedupKey(payload: any): string | null {
            return payload?.id ? `test:${payload.id}` : null;
        }
    }

    beforeEach(() => {
        mockChannel = {
            consume: jest.fn(),
            ack: jest.fn(),
            nack: jest.fn(),
        };

        mockRabbit = {
            getChannel: jest.fn().mockResolvedValue(mockChannel),
            assertQueueWithOptions: jest.fn().mockResolvedValue(undefined),
            assertQueue: jest.fn().mockResolvedValue(undefined),
            setPrefetch: jest.fn().mockResolvedValue(undefined),
        } as any;

        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            ttl: jest.fn(),
        } as any;

        mockConfig = {
            get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, any> = {};
                return config[key] !== undefined ? config[key] : defaultValue;
            }),
        } as any;

        options = {
            queue: "test.queue",
            dlq: "test.dlq",
            prefetch: 10,
            retryMax: 3,
            redisUrl: "redis://localhost:6379",
            dedupTtlSeconds: 60,
        };

        // Get the mocked Redis constructor and set up the mock
        const RedisMock = require("ioredis");
        RedisMock.mockImplementation(() => mockRedis);
    });

    /**
     * EN -
     * Tests queue initialization with DLQ configuration.
     * Verifies that main queue and DLQ are created with correct options.
     * 
     * PT -
     * Testa inicialização de fila com configuração de DLQ.
     * Verifica que fila principal e DLQ são criadas com opções corretas.
     */
    it("should initialize queues with DLQ configuration", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);
        await consumer.start();

        expect(mockRabbit.assertQueueWithOptions).toHaveBeenCalledWith(
            "test.queue",
            expect.objectContaining({
                deadLetterExchange: "",
                deadLetterRoutingKey: "test.dlq",
            })
        );
        expect(mockRabbit.assertQueue).toHaveBeenCalledWith("test.dlq");
    });

    /**
     * EN -
     * Tests prefetch configuration.
     * Verifies that prefetch is set correctly for parallel processing.
     * 
     * PT -
     * Testa configuração de prefetch.
     * Verifica que prefetch é configurado corretamente para processamento paralelo.
     */
    it("should configure prefetch for parallel processing", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);
        await consumer.start();

        expect(mockRabbit.setPrefetch).toHaveBeenCalledWith(10);
    });

    /**
     * EN -
     * Tests message consumption setup.
     * Verifies that consume callback is registered with correct options.
     * 
     * PT -
     * Testa configuração de consumo de mensagens.
     * Verifica que callback de consumo é registrado com opções corretas.
     */
    it("should setup message consumption with noAck false", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);
        await consumer.start();

        expect(mockChannel.consume).toHaveBeenCalledWith(
            "test.queue",
            expect.any(Function),
            {noAck: false}
        );
    });

    /**
     * EN -
     * Tests deduplication using Redis.
     * Verifies that duplicate messages are skipped based on dedup key.
     * 
     * PT -
     * Testa desduplicação usando Redis.
     * Verifica que mensagens duplicadas são ignoradas baseado na chave de dedup.
     */
    it("should skip duplicate messages using Redis deduplication", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);
        (mockRedis.get as jest.Mock).mockResolvedValue("1");

        await consumer.start();

        const consumeCallback = mockChannel.consume.mock.calls[0][1];
        const mockMsg = {
            content: Buffer.from(JSON.stringify({id: "test-id"})),
            properties: {headers: {}},
        };

        await consumeCallback(mockMsg);

        expect(mockRedis.get).toHaveBeenCalled();
        expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    });

    /**
     * EN -
     * Tests retry logic with exponential backoff.
     * Verifies that failed messages are retried up to retryMax times.
     * 
     * PT -
     * Testa lógica de retry com backoff exponencial.
     * Verifica que mensagens falhadas são reprocessadas até retryMax vezes.
     */
    it("should retry failed messages up to retryMax times", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);
        (mockRedis.get as jest.Mock).mockResolvedValue(null);

        await consumer.start();

        const consumeCallback = mockChannel.consume.mock.calls[0][1];
        const mockMsg = {
            content: Buffer.from(JSON.stringify({id: "test-id"})),
            properties: {
                headers: {"x-retry-count": 2},
            },
        };

        // Mock process to throw error
        jest.spyOn(consumer as any, "process").mockRejectedValue(new Error("Processing failed"));

        await consumeCallback(mockMsg);

        // Should nack with requeue false after max retries
        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    });

    /**
     * EN -
     * Tests invalid JSON message handling.
     * Verifies that invalid JSON messages are routed to DLQ.
     * 
     * PT -
     * Testa tratamento de mensagens JSON inválidas.
     * Verifica que mensagens JSON inválidas são roteadas para DLQ.
     */
    it("should route invalid JSON messages to DLQ", async () => {
        const consumer = new TestConsumer(mockRabbit, options, mockConfig);

        await consumer.start();

        const consumeCallback = mockChannel.consume.mock.calls[0][1];
        const mockMsg = {
            content: Buffer.from("invalid json"),
            properties: {headers: {}},
        };

        await consumeCallback(mockMsg);

        expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    });
});

