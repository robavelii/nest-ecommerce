import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { AuditService } from "./audit.service";
import {
  AuditAction,
  AuditResource,
} from "../../database/entities/audit-log.entity";
import { AUDIT_LOG_KEY } from "../decorators/audit-log.decorator";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditConfig = this.reflector.get(AUDIT_LOG_KEY, context.getHandler());

    if (!auditConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return next.handle().pipe(
      tap({
        next: async (data) => {
          if (!user) return;

          const resourceId = auditConfig.resourceIdParam
            ? request.params[auditConfig.resourceIdParam] ||
              request.body?.id ||
              data?.id
            : undefined;

          await this.auditService.log({
            userId: user.userId || user.id,
            userEmail: user.email,
            action: auditConfig.action,
            resourceType: auditConfig.resourceType,
            resourceId,
            description: `${auditConfig.action} on ${auditConfig.resourceType}${resourceId ? ` (${resourceId})` : ""}`,
            request,
          });
        },
      }),
    );
  }
}
