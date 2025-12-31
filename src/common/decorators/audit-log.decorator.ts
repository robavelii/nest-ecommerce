import { SetMetadata } from "@nestjs/common";
import {
  AuditAction,
  AuditResource,
} from "../../database/entities/audit-log.entity";

export const AUDIT_LOG_KEY = "audit_log";

export const AuditLog = (
  action: AuditAction,
  resourceType: AuditResource,
  resourceIdParam?: string,
) => SetMetadata(AUDIT_LOG_KEY, { action, resourceType, resourceIdParam });

export { AuditAction, AuditResource };
