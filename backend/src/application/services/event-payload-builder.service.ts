import { Injectable, Inject } from "@nestjs/common";
import {
  UserRepository,
  USER_REPOSITORY,
} from "@domain/repositories/users/user.repository";
import {
  CompanyRepository,
  COMPANY_REPOSITORY,
} from "@domain/repositories/companys/company.repository";
import { ConfigService } from "@nestjs/config";

/**
 * EN -
 * EventPayloadBuilderInput - Input interface for building standardized event payloads.
 *
 * Contains all necessary information to build a complete event payload including
 * event identification, sender/receiver information, and additional context data.
 *
 * PT -
 * EventPayloadBuilderInput - Interface de entrada para construir payloads de eventos padronizados.
 *
 * Contém todas as informações necessárias para construir um payload de evento completo incluindo
 * identificação do evento, informações de remetente/destinatário e dados de contexto adicionais.
 */
export interface EventPayloadBuilderInput {
  eventId: string;
  senderId?: string | null;
  receiverId?: string | null;
  receiverEmail?: string | null;
  companyId?: string | null;
  additionalData?: Record<string, any>;
}

/**
 * EN -
 * StandardizedEventPayload - Standardized format for domain event payloads.
 *
 * Ensures consistent structure across all domain events with sender, receiver,
 * company information, and extensible additional data fields.
 *
 * PT -
 * StandardizedEventPayload - Formato padronizado para payloads de eventos de domínio.
 *
 * Garante estrutura consistente em todos os eventos de domínio com informações de remetente,
 * destinatário, empresa e campos de dados adicionais extensíveis.
 */
export interface StandardizedEventPayload {
  eventId: string;
  timestamp: string;
  sender: {
    id: string;
    name: string;
    email: string;
  } | null;
  receiver: {
    id: string;
    name: string;
    email: string;
  } | null;
  company?: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string;
    memberCount?: number;
  } | null;
  [key: string]: any;
}

/**
 * EN -
 * EventPayloadBuilderService - Service responsible for building standardized event payloads.
 *
 * This service transforms raw event data into a standardized format that includes enriched
 * user and company information. It follows SOLID principles with single-responsibility
 * methods for each enrichment step.
 *
 * Architecture:
 * - Builds base payload with event ID and timestamp
 * - Enriches payload with sender information (from ID or email)
 * - Enriches payload with receiver information (from ID or email)
 * - Enriches payload with company information (if applicable)
 * - Merges additional data from input
 *
 * Benefits:
 * - Consistent payload structure across all events
 * - Automatic enrichment of user and company data
 * - Extensible for future event types
 * - Single source of truth for payload building
 *
 * PT -
 * EventPayloadBuilderService - Serviço responsável por construir payloads de eventos padronizados.
 *
 * Este serviço transforma dados brutos de eventos em um formato padronizado que inclui informações
 * enriquecidas de usuário e empresa. Segue princípios SOLID com métodos de responsabilidade única
 * para cada etapa de enriquecimento.
 *
 * Arquitetura:
 * - Constrói payload base com ID do evento e timestamp
 * - Enriquece payload com informações do remetente (de ID ou email)
 * - Enriquece payload com informações do destinatário (de ID ou email)
 * - Enriquece payload com informações da empresa (se aplicável)
 * - Mescla dados adicionais da entrada
 *
 * Benefícios:
 * - Estrutura de payload consistente em todos os eventos
 * - Enriquecimento automático de dados de usuário e empresa
 * - Extensível para futuros tipos de eventos
 * - Fonte única de verdade para construção de payloads
 */
@Injectable()
export class EventPayloadBuilderService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * EN -
   * Builds a standardized event payload from input data.
   * Enriches payload with user and company information from repositories.
   *
   * PT -
   * Constrói um payload de evento padronizado a partir de dados de entrada.
   * Enriquece payload com informações de usuário e empresa dos repositórios.
   *
   * @param input - Input data containing event ID, user IDs, company ID, and additional data
   * @returns Standardized event payload with enriched information
   */
  async build(
    input: EventPayloadBuilderInput,
  ): Promise<StandardizedEventPayload> {
    const payload = this.buildBasePayload(input);

    await this.enrichSenderInfo(payload, input.senderId);
    await this.enrichReceiverInfo(
      payload,
      input.receiverId,
      input.receiverEmail,
    );
    await this.enrichCompanyInfo(payload, input.companyId);

    return payload;
  }

  /**
   * EN -
   * Builds the base payload structure with event ID, timestamp, and additional data.
   * Initializes sender and receiver as null (will be enriched later).
   *
   * PT -
   * Constrói a estrutura base do payload com ID do evento, timestamp e dados adicionais.
   * Inicializa remetente e destinatário como null (serão enriquecidos depois).
   *
   * @param input - Input data containing event ID and additional data
   * @returns Base payload structure
   */
  private buildBasePayload(
    input: EventPayloadBuilderInput,
  ): StandardizedEventPayload {
    return {
      eventId: input.eventId,
      timestamp: new Date().toISOString(),
      sender: null,
      receiver: null,
      ...input.additionalData,
    };
  }

  /**
   * EN -
   * Enriches payload with sender user information by fetching from repository.
   * Only enriches if senderId is provided and user exists.
   *
   * PT -
   * Enriquece payload com informações do usuário remetente buscando do repositório.
   * Apenas enriquece se senderId for fornecido e usuário existir.
   *
   * @param payload - Payload to enrich
   * @param senderId - ID of the sender user (optional)
   */
  private async enrichSenderInfo(
    payload: StandardizedEventPayload,
    senderId?: string | null,
  ): Promise<void> {
    if (!senderId) return;

    const sender = await this.userRepo.findById(senderId);
    if (!sender) return;

    payload.sender = {
      id: sender.id,
      name: sender.name,
      email: sender.email.toString(),
    };
  }

  /**
   * EN -
   * Enriches payload with receiver user information by fetching from repository.
   * Handles both receiverId (preferred) and receiverEmail (fallback) cases.
   * Sets receiverId in payload if found by email.
   *
   * PT -
   * Enriquece payload com informações do usuário destinatário buscando do repositório.
   * Trata tanto casos de receiverId (preferido) quanto receiverEmail (fallback).
   * Define receiverId no payload se encontrado por email.
   *
   * @param payload - Payload to enrich
   * @param receiverId - ID of the receiver user (optional, preferred)
   * @param receiverEmail - Email of the receiver user (optional, fallback)
   */
  private async enrichReceiverInfo(
    payload: StandardizedEventPayload,
    receiverId?: string | null,
    receiverEmail?: string | null,
  ): Promise<void> {
    if (receiverId) {
      const receiver = await this.userRepo.findById(receiverId);
      if (receiver) {
        payload.receiver = {
          id: receiver.id,
          name: receiver.name,
          email: receiver.email.toString(),
        };
      }
      return;
    }

    if (receiverEmail) {
      const receiver = await this.userRepo.findByEmail(receiverEmail);
      if (receiver) {
        payload.receiver = {
          id: receiver.id,
          name: receiver.name,
          email: receiver.email.toString(),
        };
        payload.receiverId = receiver.id;
      } else {
        payload.receiverEmail = receiverEmail;
      }
    }
  }

  /**
   * EN -
   * Enriches payload with company information by fetching from repository.
   * Includes company details and member count from memberships.
   *
   * PT -
   * Enriquece payload com informações da empresa buscando do repositório.
   * Inclui detalhes da empresa e contagem de membros das associações.
   *
   * @param payload - Payload to enrich
   * @param companyId - ID of the company (optional)
   */
  private async enrichCompanyInfo(
    payload: StandardizedEventPayload,
    companyId?: string | null,
  ): Promise<void> {
    if (!companyId) return;

    const company = await this.companyRepo.findById(companyId);
    if (!company) return;

    const memberships = company.memberships || [];
    payload.company = {
      id: company.id,
      name: company.name,
      description: company.description || null,
      logoUrl: company.logoUrl || null,
      createdAt: company.createdAt.toISOString(),
      memberCount: memberships.length,
    };
    payload.companyId = company.id;
  }
}
