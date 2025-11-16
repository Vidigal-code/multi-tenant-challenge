import {Injectable, Inject} from "@nestjs/common";
import {UserRepository, USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {CompanyRepository, COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {ConfigService} from "@nestjs/config";

export interface EventPayloadBuilderInput {
    eventId: string;
    senderId?: string | null;
    receiverId?: string | null;
    receiverEmail?: string | null;
    companyId?: string | null;
    additionalData?: Record<string, any>;
}

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

@Injectable()
export class EventPayloadBuilderService {
    constructor(
        @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
        private readonly configService: ConfigService,
    ) {
    }

    async build(input: EventPayloadBuilderInput): Promise<StandardizedEventPayload> {
        const payload: StandardizedEventPayload = {
            eventId: input.eventId,
            timestamp: new Date().toISOString(),
            sender: null,
            receiver: null,
            ...input.additionalData,
        };

        if (input.senderId) {
            const sender = await this.userRepo.findById(input.senderId);
            if (sender) {
                payload.sender = {
                    id: sender.id,
                    name: sender.name,
                    email: sender.email.toString(),
                };
            }
        }

        if (input.receiverId) {
            const receiver = await this.userRepo.findById(input.receiverId);
            if (receiver) {
                payload.receiver = {
                    id: receiver.id,
                    name: receiver.name,
                    email: receiver.email.toString(),
                };
            }
        } else if (input.receiverEmail) {
            const receiver = await this.userRepo.findByEmail(input.receiverEmail);
            if (receiver) {
                payload.receiver = {
                    id: receiver.id,
                    name: receiver.name,
                    email: receiver.email.toString(),
                };
                payload.receiverId = receiver.id;
            } else {
                payload.receiverEmail = input.receiverEmail;
            }
        }

        if (input.companyId) {
            const company = await this.companyRepo.findById(input.companyId);
            if (company) {
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

        return payload;
    }
}

