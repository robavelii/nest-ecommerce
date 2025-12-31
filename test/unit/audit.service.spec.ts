import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditService } from "../../src/common/audit/audit.service";
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from "../../src/database/entities/audit-log.entity";
import { Request } from "express";

describe("AuditService", () => {
  let service: AuditService;
  let auditLogRepository: Repository<AuditLog>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useFactory: () => ({
            find: jest.fn(),
            save: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("log", () => {
    it("should create audit log entry", async () => {
      const createAuditLogDto = {
        userId: "user-123",
        userEmail: "test@example.com",
        action: AuditAction.LOGIN,
        resourceType: AuditResource.USER,
        resourceId: "user-123",
        description: "User logged in",
        oldValues: { role: "customer" },
        newValues: { role: "admin" },
        request: {
          ip: "127.0.0.1",
          header: jest.fn().mockReturnValue("UserAgent/1.0"),
          traceId: "trace-123",
        } as any,
      };

      (auditLogRepository.create as jest.Mock).mockReturnValue(
        createAuditLogDto,
      );
      (auditLogRepository.save as jest.Mock).mockResolvedValue(undefined);

      await service.log(createAuditLogDto);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: "user-123",
        userEmail: "test@example.com",
        action: AuditAction.LOGIN,
        resourceType: AuditResource.USER,
        resourceId: "user-123",
        description: "User logged in",
        oldValues: { role: "customer" },
        newValues: { role: "admin" },
        ipAddress: "127.0.0.1",
        userAgent: "UserAgent/1.0",
        traceId: "trace-123",
      });
      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it("should create audit log without optional fields", async () => {
      const createAuditLogDto = {
        userId: "user-123",
        userEmail: "test@example.com",
        action: AuditAction.LOGOUT,
        resourceType: AuditResource.USER,
        description: "User logged out",
      };

      (auditLogRepository.create as jest.Mock).mockReturnValue(
        createAuditLogDto,
      );
      (auditLogRepository.save as jest.Mock).mockResolvedValue(undefined);

      await service.log(createAuditLogDto);

      expect(auditLogRepository.create).toHaveBeenCalledWith({
        userId: "user-123",
        userEmail: "test@example.com",
        action: AuditAction.LOGOUT,
        resourceType: AuditResource.USER,
        description: "User logged out",
        ipAddress: undefined,
        userAgent: undefined,
        traceId: undefined,
      });
    });
  });

  describe("findByUserId", () => {
    it("should return audit logs by user ID", async () => {
      const mockLogs = [
        { id: "log-1", userId: "user-123", action: AuditAction.LOGIN },
        { id: "log-2", userId: "user-123", action: AuditAction.LOGOUT },
      ];

      (auditLogRepository.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.findByUserId("user-123");

      expect(result).toEqual(mockLogs);
      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        order: { createdAt: "DESC" },
        take: 50,
      });
    });

    it("should apply custom limit", async () => {
      (auditLogRepository.find as jest.Mock).mockResolvedValue([]);

      await service.findByUserId("user-123", 25);

      expect(auditLogRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });
  });

  describe("findByResource", () => {
    it("should return audit logs by resource", async () => {
      const mockLogs = [
        {
          id: "log-1",
          resourceType: AuditResource.ORDER,
          resourceId: "order-123",
        },
        {
          id: "log-2",
          resourceType: AuditResource.ORDER,
          resourceId: "order-123",
        },
      ];

      (auditLogRepository.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.findByResource(
        AuditResource.ORDER,
        "order-123",
      );

      expect(result).toEqual(mockLogs);
      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { resourceType: AuditResource.ORDER, resourceId: "order-123" },
        order: { createdAt: "DESC" },
        take: 50,
      });
    });
  });

  describe("findByAction", () => {
    it("should return audit logs by action", async () => {
      const mockLogs = [
        { id: "log-1", action: AuditAction.LOGIN, userId: "user-1" },
        { id: "log-2", action: AuditAction.LOGIN, userId: "user-2" },
      ];

      (auditLogRepository.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.findByAction(AuditAction.LOGIN);

      expect(result).toEqual(mockLogs);
      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { action: AuditAction.LOGIN },
        order: { createdAt: "DESC" },
        take: 50,
      });
    });
  });

  describe("findByDateRange", () => {
    it("should return audit logs by date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const mockLogs = [
        { id: "log-1", createdAt: new Date("2024-01-15") },
        { id: "log-2", createdAt: new Date("2024-01-20") },
      ];

      (auditLogRepository.find as jest.Mock).mockResolvedValue(mockLogs);

      const result = await service.findByDateRange(startDate, endDate);

      expect(result).toEqual(mockLogs);
      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          } as any,
        },
        order: { createdAt: "DESC" },
      });
    });
  });
});
