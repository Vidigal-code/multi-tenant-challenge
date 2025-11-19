import {CanActivate, ExecutionContext, Injectable} from "@nestjs/common";
import {WorkerTokenPayload, WorkerTokenService} from "../services/worker-token.service";
import {Request} from "express";

type WorkerRequest = Request & {
    workerToken?: WorkerTokenPayload;
};

@Injectable()
export class WorkerAuthGuard implements CanActivate {
    constructor(private readonly workerTokenService: WorkerTokenService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<WorkerRequest>();
        request.workerToken = await this.workerTokenService.verifyRequest(request);
        return true;
    }
}

