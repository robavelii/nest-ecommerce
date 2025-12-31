import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CouponsService } from "../../src/modules/coupons/coupons.service";
import {
  Coupon,
  CouponStatus,
  DiscountType,
} from "../../src/database/entities/coupon.entity";
import { TestFactory } from "../factories/test.factory";
import { LoggerServiceImpl } from "../../src/common/logger/logger.service";

describe("CouponsService", () => {
  let service: CouponsService;
  let couponRepository: Repository<Coupon>;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: LoggerServiceImpl,
          useValue: mockLogger,
        },
        {
          provide: getRepositoryToken(Coupon),
          useFactory: () => ({
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getOne: jest.fn(),
              getCount: jest.fn(),
            })),
          }),
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
    couponRepository = module.get(getRepositoryToken(Coupon));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create a new coupon", async () => {
      const couponData = TestFactory.createCoupon({
        code: "NEWCODE20",
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(null);
      (couponRepository.create as jest.Mock).mockReturnValue(couponData);
      (couponRepository.save as jest.Mock).mockResolvedValue({
        id: "coupon-123",
        ...couponData,
      });

      const result = await service.create(couponData as any);

      expect(result).toHaveProperty("id", "coupon-123");
      expect(result.code).toBe("NEWCODE20");
      expect(result.status).toBe(CouponStatus.ACTIVE);
      expect(couponRepository.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw BadRequestException for duplicate code", async () => {
      const couponData = TestFactory.createCoupon({
        code: "DUPCODE",
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue({
        id: "existing-coupon",
      });

      await expect(service.create(couponData as any)).rejects.toThrow(
        "Coupon code already exists",
      );
    });
  });

  describe("findAll", () => {
    it("should return paginated coupons", async () => {
      const mockCoupons = [
        TestFactory.createCoupon({ id: "coupon-1" }),
        TestFactory.createCoupon({ id: "coupon-2" }),
      ];

      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockCoupons, 2]),
      };

      (couponRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll(1, 10);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("meta");
      expect(result.data).toEqual(mockCoupons);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by status", async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (couponRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll(1, 10, CouponStatus.ACTIVE);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "coupon.status = :status",
        { status: CouponStatus.ACTIVE },
      );
    });
  });

  describe("findOne", () => {
    it("should return coupon by ID", async () => {
      const mockCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "TEST20",
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.findOne("coupon-123");

      expect(result).toEqual(mockCoupon);
    });

    it("should throw NotFoundException for non-existent coupon", async () => {
      (couponRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne("coupon-999")).rejects.toThrow(
        "Coupon not found",
      );
    });
  });

  describe("findByCode", () => {
    it("should return coupon by code", async () => {
      const mockCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "SUMMER20",
        status: CouponStatus.ACTIVE,
        usedCount: 5,
        maxUses: 100,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.findByCode("summer20");

      expect(result).toEqual(mockCoupon);
      expect(couponRepository.findOne).toHaveBeenCalledWith({
        where: { code: "SUMMER20" },
      });
    });

    it("should throw NotFoundException for non-existent code", async () => {
      (couponRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findByCode("NONEXISTENT")).rejects.toThrow(
        "Invalid coupon code",
      );
    });

    it("should throw BadRequestException for inactive coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        status: CouponStatus.INACTIVE,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      await expect(service.findByCode("INACTIVE20")).rejects.toThrow(
        "Coupon is not active",
      );
    });

    it("should throw BadRequestException for expired coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        status: CouponStatus.ACTIVE,
        validUntil: new Date(Date.now() - 86400000),
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      await expect(service.findByCode("EXPIRED20")).rejects.toThrow(
        "Coupon has expired",
      );
    });

    it("should throw BadRequestException for usage limit reached", async () => {
      const mockCoupon = TestFactory.createCoupon({
        status: CouponStatus.ACTIVE,
        usedCount: 100,
        maxUses: 100,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      await expect(service.findByCode("FULLUSED")).rejects.toThrow(
        "Coupon usage limit reached",
      );
    });
  });

  describe("update", () => {
    it("should update coupon", async () => {
      const existingCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "OLDCODE",
        discountValue: 10,
      });

      const updateData = { discountValue: 20 };

      (couponRepository.findOne as jest.Mock).mockResolvedValue(existingCoupon);
      (couponRepository.save as jest.Mock).mockResolvedValue({
        ...existingCoupon,
        ...updateData,
      });

      const result = await service.update("coupon-123", updateData);

      expect(result.discountValue).toBe(20);
      expect(couponRepository.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw NotFoundException for non-existent coupon", async () => {
      (couponRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update("coupon-999", {})).rejects.toThrow(
        "Coupon not found",
      );
    });
  });

  describe("remove", () => {
    it("should delete coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "TO DELETE",
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);
      (couponRepository.remove as jest.Mock).mockResolvedValue(undefined);

      await service.remove("coupon-123");

      expect(couponRepository.findOne).toHaveBeenCalledWith({
        where: { id: "coupon-123" },
      });
      expect(couponRepository.remove).toHaveBeenCalledWith(mockCoupon);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw NotFoundException for non-existent coupon", async () => {
      (couponRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove("coupon-999")).rejects.toThrow(
        "Coupon not found",
      );
    });
  });

  describe("applyCoupon", () => {
    it("should apply percentage discount coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "PERCENT20",
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        minOrderAmount: 50,
        maxUses: 100,
        maxUsesPerUser: 5,
        status: CouponStatus.ACTIVE,
        usedCount: 10,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);
      couponRepository.manager = {} as any;
      couponRepository.manager.getRepository = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.applyCoupon("PERCENT20", 100);

      expect(result.discount).toBe(20);
      expect(result.couponId).toBe("coupon-123");
      expect(result.freeShipping).toBe(false);
    });

    it("should apply fixed amount discount coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        id: "coupon-123",
        code: "FIXED10",
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 10,
        status: CouponStatus.ACTIVE,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);
      couponRepository.manager = {} as any;
      couponRepository.manager.getRepository = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.applyCoupon("FIXED10", 100);

      expect(result.discount).toBe(10);
    });

    it("should throw BadRequestException below minimum order amount", async () => {
      const mockCoupon = TestFactory.createCoupon({
        minOrderAmount: 100,
        status: CouponStatus.ACTIVE,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);

      await expect(service.applyCoupon("MIN100", 50)).rejects.toThrow(
        "Minimum order amount of $100 required for this coupon",
      );
    });

    it("should not exceed subtotal", async () => {
      const mockCoupon = TestFactory.createCoupon({
        discountType: DiscountType.PERCENTAGE,
        discountValue: 150,
        status: CouponStatus.ACTIVE,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);
      couponRepository.manager = {} as any;
      couponRepository.manager.getRepository = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.applyCoupon("BIG150", 100);

      expect(result.discount).toBe(100);
    });

    it("should handle free shipping coupon", async () => {
      const mockCoupon = TestFactory.createCoupon({
        freeShipping: true,
        status: CouponStatus.ACTIVE,
      });

      (couponRepository.findOne as jest.Mock).mockResolvedValue(mockCoupon);
      couponRepository.manager = {} as any;
      couponRepository.manager.getRepository = jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.applyCoupon("FREESHIP", 50);

      expect(result.freeShipping).toBe(true);
    });
  });

  describe("incrementUsage", () => {
    it("should increment coupon usage count", async () => {
      (couponRepository.increment as jest.Mock).mockResolvedValue(undefined);

      await service.incrementUsage("coupon-123");

      expect(couponRepository.increment).toHaveBeenCalledWith(
        { id: "coupon-123" },
        "usedCount",
        1,
      );
    });
  });

  describe("deactivateExpiredCoupons", () => {
    it("should deactivate expired coupons", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };

      (couponRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.deactivateExpiredCoupons();

      expect(mockQueryBuilder.execute).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        "Expired coupons deactivated",
        "CouponsService",
      );
    });
  });
});
