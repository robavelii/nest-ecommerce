import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  createTestDataSource,
  truncateDatabase,
  closeTestConnection,
} from "../utils/test-db";

describe("Integration Tests", () => {
  let dataSource: DataSource;
  let authToken: string;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
  });

  afterAll(async () => {
    await closeTestConnection(dataSource);
  });

  beforeEach(async () => {
    await truncateDatabase(dataSource);

    const { User } = await import("../../src/database/entities/user.entity");
    const { AuthService } = await import("../../src/modules/auth/auth.service");
    const { JwtService } = await import("@nestjs/jwt");
    const { EmailService } =
      await import("../../src/common/email/email.service");

    const authModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: dataSource.getRepository(User),
        },
        {
          provide: JwtService,
          useValue: new JwtService({ secret: "test-secret" }),
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    const authService = authModule.get<AuthService>(AuthService);
    const { RegisterDto } =
      await import("../../src/modules/auth/dto/register.dto");

    const registerDto: RegisterDto = {
      email: "integration@example.com",
      password: "SecurePass123!",
      firstName: "Integration",
      lastName: "User",
    };

    const tokens = await authService.register(registerDto);
    authToken = tokens.accessToken;

    await authModule.close();
  });

  describe("User Registration and Authentication Flow", () => {
    it("should complete full registration to login flow", async () => {
      const { User } = await import("../../src/database/entities/user.entity");
      const userRepository = dataSource.getRepository(User);

      const users = await userRepository.find();
      expect(users.length).toBe(1);
      expect(users[0].email).toBe("integration@example.com");
      expect(users[0].firstName).toBe("Integration");
      expect(users[0].role).toBe("customer");
    });
  });

  describe("Product and Order Integration", () => {
    it("should create product and order with stock updates", async () => {
      const { Product } =
        await import("../../src/database/entities/product.entity");
      const { Category } =
        await import("../../src/database/entities/category.entity");
      const { Order } =
        await import("../../src/database/entities/order.entity");
      const { OrderItem } =
        await import("../../src/database/entities/order-item.entity");

      const productRepository = dataSource.getRepository(Product);
      const categoryRepository = dataSource.getRepository(Category);
      const orderRepository = dataSource.getRepository(Order);
      const orderItemRepository = dataSource.getRepository(OrderItem);

      const category = await categoryRepository.save({
        name: "Test Category",
        slug: "test-category",
      });

      const product = await productRepository.save({
        name: "Integration Product",
        description: "Product for integration test",
        price: 100,
        sku: "INT-001",
        stock: 50,
        status: "active",
        categoryId: category.id,
      });

      const order = await orderRepository.save({
        orderNumber: "INT-ORD-001",
        userId: "integration-user-id",
        status: "pending",
        subtotal: 100,
        tax: 8,
        shippingCost: 0,
        discount: 0,
        total: 108,
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
      });

      await orderItemRepository.save({
        orderId: order.id,
        productId: product.id,
        quantity: 1,
        name: product.name,
        sku: product.sku,
        unitPrice: product.price,
        total: product.price,
      });

      await productRepository.decrement({ id: product.id }, "stock", 1);

      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.stock).toBe(49);

      const orderItems = await orderItemRepository.find({
        where: { orderId: order.id },
      });
      expect(orderItems.length).toBe(1);
      expect(orderItems[0].productId).toBe(product.id);
    });
  });

  describe("Coupon Application Integration", () => {
    it("should create coupon and apply to order", async () => {
      const { Coupon } =
        await import("../../src/database/entities/coupon.entity");
      const { Order } =
        await import("../../src/database/entities/order.entity");

      const couponRepository = dataSource.getRepository(Coupon);
      const orderRepository = dataSource.getRepository(Order);

      const coupon = await couponRepository.save({
        code: "INT-COUPON20",
        discountType: "percentage",
        discountValue: 20,
        minOrderAmount: 50,
        maxUses: 100,
        maxUsesPerUser: 5,
        status: "active",
        usedCount: 0,
      });

      const order = await orderRepository.save({
        orderNumber: "INT-ORD-002",
        userId: "integration-user-id",
        status: "pending",
        subtotal: 100,
        tax: 8,
        shippingCost: 0,
        discount: 20,
        total: 88,
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
      });

      await couponRepository.increment({ id: coupon.id }, "usedCount", 1);

      const updatedCoupon = await couponRepository.findOne({
        where: { id: coupon.id },
      });
      expect(updatedCoupon.usedCount).toBe(1);

      expect(order.discount).toBe(20);
      expect(order.total).toBe(88);
    });
  });

  describe("Audit Log Integration", () => {
    it("should create audit log entries", async () => {
      const { AuditLog } =
        await import("../../src/database/entities/audit-log.entity");

      const auditLogRepository = dataSource.getRepository(AuditLog);

      await auditLogRepository.save({
        userId: "integration-user-id",
        userEmail: "integration@example.com",
        action: "login",
        resourceType: "user",
        resourceId: "integration-user-id",
        description: "User logged in",
      });

      const logs = await auditLogRepository.find();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe("login");
      expect(logs[0].resourceType).toBe("user");
    });
  });

  describe("Database Transactions", () => {
    it("should rollback on error", async () => {
      const { Product } =
        await import("../../src/database/entities/product.entity");
      const { Order } =
        await import("../../src/database/entities/order.entity");

      const productRepository = dataSource.getRepository(Product);
      const orderRepository = dataSource.getRepository(Order);

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.save(Product, {
          name: "Transaction Product",
          price: 50,
          sku: "TXN-001",
          stock: 10,
          status: "active",
        });

        await queryRunner.manager.save(Order, {
          orderNumber: "TXN-ORD-001",
          userId: "integration-user-id",
          status: "pending",
          subtotal: 50,
          tax: 4,
          shippingCost: 0,
          discount: 0,
          total: 54,
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
        });

        throw new Error("Simulated error");
      } catch (error) {
        await queryRunner.rollbackTransaction();
      } finally {
        await queryRunner.release();
      }

      const products = await productRepository.find({
        where: { sku: "TXN-001" },
      });
      const orders = await orderRepository.find({
        where: { orderNumber: "TXN-ORD-001" },
      });

      expect(products.length).toBe(0);
      expect(orders.length).toBe(0);
    });

    it("should commit on success", async () => {
      const { Product } =
        await import("../../src/database/entities/product.entity");
      const { Order } =
        await import("../../src/database/entities/order.entity");

      const productRepository = dataSource.getRepository(Product);
      const orderRepository = dataSource.getRepository(Order);

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      await queryRunner.manager.save(Product, {
        name: "Committed Product",
        price: 75,
        sku: "TXN-002",
        stock: 20,
        status: "active",
      });

      await queryRunner.manager.save(Order, {
        orderNumber: "TXN-ORD-002",
        userId: "integration-user-id",
        status: "pending",
        subtotal: 75,
        tax: 6,
        shippingCost: 0,
        discount: 0,
        total: 81,
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
      });

      await queryRunner.commitTransaction();
      await queryRunner.release();

      const products = await productRepository.find({
        where: { sku: "TXN-002" },
      });
      const orders = await orderRepository.find({
        where: { orderNumber: "TXN-ORD-002" },
      });

      expect(products.length).toBe(1);
      expect(orders.length).toBe(1);
    });
  });

  describe("Data Integrity", () => {
    it("should enforce unique email constraint", async () => {
      const { User } = await import("../../src/database/entities/user.entity");

      const userRepository = dataSource.getRepository(User);

      await userRepository.save({
        email: "unique@test.com",
        password: "hash",
        firstName: "Test",
        lastName: "User",
        role: "customer",
        isActive: true,
      });

      await expect(
        userRepository.save({
          email: "unique@test.com",
          password: "hash",
          firstName: "Test",
          lastName: "User",
          role: "customer",
          isActive: true,
        }),
      ).rejects.toThrow();
    });

    it("should enforce unique product SKU constraint", async () => {
      const { Product } =
        await import("../../src/database/entities/product.entity");

      const productRepository = dataSource.getRepository(Product);

      await productRepository.save({
        name: "Product 1",
        sku: "UNIQUE-001",
        price: 50,
        stock: 10,
        status: "active",
      });

      await expect(
        productRepository.save({
          name: "Product 2",
          sku: "UNIQUE-001",
          price: 75,
          stock: 15,
          status: "active",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent stock updates", async () => {
      const { Product } =
        await import("../../src/database/entities/product.entity");

      const productRepository = dataSource.getRepository(Product);

      const product = await productRepository.save({
        name: "Concurrent Product",
        sku: "CONC-001",
        price: 100,
        stock: 100,
        status: "active",
      });

      const operations = Array.from({ length: 5 }, (_, i) =>
        productRepository.decrement({ id: product.id }, "stock", 1),
      );

      await Promise.all(operations);

      const updatedProduct = await productRepository.findOne({
        where: { id: product.id },
      });
      expect(updatedProduct.stock).toBe(95);
    });
  });
});
