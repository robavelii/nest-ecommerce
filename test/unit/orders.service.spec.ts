import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OrdersService } from "../../src/modules/orders/orders.service";
import { Order, OrderStatus } from "../../src/database/entities/order.entity";
import { OrderItem } from "../../src/database/entities/order-item.entity";
import {
  Product,
  ProductStatus,
} from "../../src/database/entities/product.entity";
import { CartItem } from "../../src/database/entities/cart-item.entity";
import {
  Payment,
  PaymentStatus,
} from "../../src/database/entities/payment.entity";
import { DataSource, QueryRunner } from "typeorm";
import { TestFactory } from "../factories/test.factory";
import { ConfigService } from "@nestjs/config";

describe("OrdersService", () => {
  let service: OrdersService;
  let orderRepository: Repository<Order>;
  let orderItemRepository: Repository<OrderItem>;
  let paymentRepository: Repository<Payment>;
  let productRepository: Repository<Product>;
  let cartItemRepository: Repository<CartItem>;
  let dataSource: DataSource;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        TAX_RATE: 0.08,
        SHIPPING_COST: 10,
        FREE_SHIPPING_THRESHOLD: 100,
      };
      return config[key];
    }),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  const mockQueryRunner: Partial<QueryRunner> = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      decrement: jest.fn(),
      increment: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: "CustomLogger",
          useValue: mockLogger,
        },
        {
          provide: getRepositoryToken(Order),
          useFactory: () => ({
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
              getOne: jest.fn(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
            })),
          }),
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: () => ({
            findOne: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            decrement: jest.fn(),
          }),
        },
        {
          provide: getRepositoryToken(CartItem),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get(getRepositoryToken(Order));
    paymentRepository = module.get(getRepositoryToken(Payment));
    productRepository = module.get(getRepositoryToken(Product));
    cartItemRepository = module.get(getRepositoryToken(CartItem));
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create order from cart items", async () => {
      const userId = "user-123";
      const mockCartItems = [
        {
          productId: "prod-1",
          quantity: 2,
          product: {
            id: "prod-1",
            name: "Product 1",
            price: 25,
            status: ProductStatus.ACTIVE,
          },
          variant: null,
        },
      ];

      const createOrderDto = {
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
          phone: "+1234567890",
        },
        paymentMethod: "stripe",
      };

      (mockQueryRunner.manager.find as jest.Mock).mockResolvedValue(
        mockCartItems,
      );
      (mockQueryRunner.manager.create as jest.Mock).mockImplementation(
        (entity, data) => data,
      );
      (mockQueryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ id: "order-123" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      (orderRepository.findOne as jest.Mock).mockResolvedValue({
        id: "order-123",
        orderNumber: "ORD-123",
        items: [],
        payments: [],
      });

      const result = await service.create(userId, createOrderDto);

      expect(result).toHaveProperty("id", "order-123");
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it("should calculate totals correctly", async () => {
      const userId = "user-123";
      const mockCartItems = [
        {
          productId: "prod-1",
          quantity: 4,
          product: {
            id: "prod-1",
            name: "Product 1",
            price: 25,
            status: ProductStatus.ACTIVE,
          },
          variant: null,
        },
      ];

      const createOrderDto = {
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
          phone: "+1234567890",
        },
      };

      (mockQueryRunner.manager.find as jest.Mock).mockResolvedValue(
        mockCartItems,
      );
      (mockQueryRunner.manager.create as jest.Mock).mockImplementation(
        (entity, data) => {
          if (entity === Order) {
            return { id: "order-123", ...data };
          }
          return data;
        },
      );

      (mockQueryRunner.manager.save as jest.Mock)
        .mockResolvedValueOnce({ id: "order-123" })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      (orderRepository.findOne as jest.Mock).mockResolvedValue({
        id: "order-123",
        items: [],
        payments: [],
      });

      const result = await service.create(userId, createOrderDto);

      expect(result.subtotal).toBe(100);
      expect(result.tax).toBe(8);
      expect(result.total).toBe(108);
    });

    it("should throw BadRequestException with empty cart", async () => {
      const userId = "user-123";

      (mockQueryRunner.manager.find as jest.Mock).mockResolvedValue([]);

      const createOrderDto = {
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          street: "123 Main St",
          city: "New York",
          state: "NY",
          zipCode: "10001",
          country: "USA",
          phone: "+1234567890",
        },
      };

      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        "Cart is empty",
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return user orders with pagination", async () => {
      const mockOrders = [
        TestFactory.createOrder({ id: "order-1", userId: "user-123" }),
        TestFactory.createOrder({ id: "order-2", userId: "user-123" }),
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockOrders, 2]),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll("user-123", { page: 1, limit: 10 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("meta");
      expect(result.data).toEqual(mockOrders);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by status", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll("user-123", {
        status: "pending",
        page: 1,
        limit: 10,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "order.status = :status",
        { status: "pending" },
      );
    });
  });

  describe("findOne", () => {
    it("should return order by ID", async () => {
      const mockOrder = TestFactory.createOrder({
        id: "order-123",
        userId: "user-123",
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOrder),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findOne("order-123", "user-123");

      expect(result).toEqual(mockOrder);
    });

    it("should throw NotFoundException for non-existent order", async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await expect(service.findOne("order-999", "user-123")).rejects.toThrow(
        "Order not found",
      );
    });
  });

  describe("cancel", () => {
    it("should cancel pending order and restore stock", async () => {
      const mockOrder = TestFactory.createOrder({
        id: "order-123",
        userId: "user-123",
        status: OrderStatus.PENDING,
        items: [
          {
            productId: "prod-1",
            quantity: 2,
            variantId: null,
            variant: null,
            order: null,
            product: null,
          } as any,
        ],
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValueOnce(mockOrder)
          .mockResolvedValueOnce({
            ...mockOrder,
            status: OrderStatus.CANCELLED,
          }),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (orderRepository.save as jest.Mock).mockResolvedValue(undefined);

      const result = await service.cancel(
        "user-123",
        "order-123",
        "Changed mind",
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(result.cancellationReason).toBe("Changed mind");
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should fail to cancel non-pending order", async () => {
      const mockOrder = TestFactory.createOrder({
        id: "order-123",
        status: OrderStatus.SHIPPED,
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOrder),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await expect(service.cancel("user-123", "order-123")).rejects.toThrow(
        "Order cannot be cancelled in current status",
      );
    });
  });

  describe("updateStatus", () => {
    it("should update order status", async () => {
      const mockOrder = TestFactory.createOrder({
        id: "order-123",
        status: OrderStatus.CONFIRMED,
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOrder),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );
      (orderRepository.save as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PROCESSING,
      });

      const result = await service.updateStatus(
        "order-123",
        OrderStatus.PROCESSING,
      );

      expect(result.status).toBe(OrderStatus.PROCESSING);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid transition", async () => {
      const mockOrder = TestFactory.createOrder({
        id: "order-123",
        status: OrderStatus.PENDING,
      });

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockOrder),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await expect(
        service.updateStatus("order-123", OrderStatus.DELIVERED),
      ).rejects.toThrow("Cannot transition from pending to delivered");
    });
  });

  describe("getUserOrderStats", () => {
    it("should return user order statistics", async () => {
      (orderRepository.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: 1250.0 }),
      };

      (orderRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.getUserOrderStats("user-123");

      expect(result).toEqual({
        totalOrders: 10,
        totalSpent: 1250,
        pendingOrders: 5,
        deliveredOrders: 3,
      });
    });
  });
});
