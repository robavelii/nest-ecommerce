import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from "../../database/entities/audit-log.entity";
import { Request } from "express";

interface CreateAuditLogDto {
  userId: string;
  userEmail: string;
  action: AuditAction;
  resourceType: AuditResource;
  resourceId?: string;
  description?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  request?: Request;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      userId: dto.userId,
      userEmail: dto.userEmail,
      action: dto.action,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
      description: dto.description,
      oldValues: dto.oldValues,
      newValues: dto.newValues,
      ipAddress: dto.request?.ip,
      userAgent: dto.request?.header("user-agent"),
      traceId: (dto.request as any)?.traceId,
    });

    await this.auditLogRepository.save(auditLog);
  }

  async findByUserId(userId: string, limit = 50) {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async findByResource(
    resourceType: AuditResource,
    resourceId: string,
    limit = 50,
  ) {
    return this.auditLogRepository.find({
      where: { resourceType, resourceId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async findByAction(action: AuditAction, limit = 50) {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  async findByDateRange(startDate: Date, endDate: Date) {
    return this.auditLogRepository.find({
      where: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        } as any,
      },
      order: { createdAt: "DESC" },
    });
  }
}
