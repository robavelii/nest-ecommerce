import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource, DataSourceOptions } from "typeorm";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("E2E Tests", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const testDbConfig: DataSourceOptions = {
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: "ecommerce_test",
    entities: ["src/database/entities/*.ts"],
    synchronize: true,
    logging: false,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    const tables = dataSource.entityMetadatas.map((meta) => meta.tableName);
    for (const table of tables) {
      await dataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  });

  describe("Health Check", () => {
    it("should return health status", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .expect(200);

      expect(response.body).toHaveProperty("status", "ok");
    });
  });

  describe("Authentication", () => {
    describe("POST /auth/register", () => {
      it("should register a new user", async () => {
        const userData = {
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        };

        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty("accessToken");
        expect(response.body).toHaveProperty("refreshToken");
        expect(response.body).toHaveProperty("tokenType", "Bearer");
      });

      it("should fail with invalid email", async () => {
        const userData = {
          email: "invalid-email",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        };

        await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send(userData)
          .expect(400);
      });

      it("should fail with weak password", async () => {
        const userData = {
          email: "test@example.com",
          password: "weak",
          firstName: "John",
          lastName: "Doe",
        };

        await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send(userData)
          .expect(400);
      });

      it("should fail with duplicate email", async () => {
        const userData = {
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        };

        await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send(userData)
          .expect(201);

        await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send(userData)
          .expect(409);
      });
    });

    describe("POST /auth/login", () => {
      beforeEach(async () => {
        await request(app.getHttpServer()).post("/api/v1/auth/register").send({
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        });
      });

      it("should login with valid credentials", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({
            email: "test@example.com",
            password: "SecurePass123!",
          })
          .expect(200);

        expect(response.body).toHaveProperty("accessToken");
        expect(response.body).toHaveProperty("refreshToken");
      });

      it("should fail with invalid email", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({
            email: "wrong@example.com",
            password: "SecurePass123!",
          })
          .expect(401);
      });

      it("should fail with invalid password", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({
            email: "test@example.com",
            password: "WrongPass123!",
          })
          .expect(401);
      });
    });

    describe("POST /auth/refresh", () => {
      let refreshToken: string;

      beforeEach(async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/login")
          .send({
            email: "test@example.com",
            password: "SecurePass123!",
          });

        refreshToken = response.body.refreshToken;
      });

      it("should refresh tokens with valid refresh token", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/refresh")
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toHaveProperty("accessToken");
        expect(response.body).toHaveProperty("refreshToken");
        expect(response.body.refreshToken).not.toBe(refreshToken);
      });

      it("should fail with invalid refresh token", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/refresh")
          .send({ refreshToken: "invalid-token" })
          .expect(401);
      });
    });

    describe("POST /auth/forgot-password", () => {
      it("should generate reset token for existing user", async () => {
        await request(app.getHttpServer()).post("/api/v1/auth/register").send({
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        });

        await request(app.getHttpServer())
          .post("/api/v1/auth/forgot-password")
          .send({ email: "test@example.com" })
          .expect(200);
      });

      it("should not reveal if user exists for non-existent email", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/forgot-password")
          .send({ email: "nonexistent@example.com" })
          .expect(200);
      });
    });

    describe("POST /auth/reset-password", () => {
      let resetToken: string;

      beforeEach(async () => {
        await request(app.getHttpServer()).post("/api/v1/auth/register").send({
          email: "test@example.com",
          password: "SecurePass123!",
          firstName: "John",
          lastName: "Doe",
        });

        await request(app.getHttpServer())
          .post("/api/v1/auth/forgot-password")
          .send({ email: "test@example.com" });

        const { User } = await import("../src/database/entities");
        const user = await dataSource.getRepository(User).findOne({
          where: { email: "test@example.com" },
        });
        resetToken = user.resetPasswordToken;
      });

      it("should reset password with valid token", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/reset-password")
          .send({
            token: resetToken,
            newPassword: "NewSecurePass456!",
          })
          .expect(200);
      });

      it("should fail with invalid token", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/auth/reset-password")
          .send({
            token: "invalid-token",
            newPassword: "NewSecurePass456!",
          })
          .expect(400);
      });
    });
  });

  describe("Products", () => {
    let authToken: string;
    let adminToken: string;
    let productId: string;

    beforeAll(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "user@example.com",
          password: "SecurePass123!",
          firstName: "Jane",
          lastName: "Smith",
        });

      authToken = registerResponse.body.accessToken;

      const adminResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "admin@example.com",
          password: "AdminPass123!",
          firstName: "Admin",
          lastName: "User",
        });

      adminToken = adminResponse.body.accessToken;

      await dataSource.query(
        `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`,
      );
    });

    describe("POST /products (Admin only)", () => {
      it("should create a new product as admin", async () => {
        const productData = {
          name: "Test Product",
          description: "A test product description",
          price: 29.99,
          sku: "TEST-001",
          stock: 100,
          categoryId: null,
        };

        const response = await request(app.getHttpServer())
          .post("/api/v1/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(productData)
          .expect(201);

        expect(response.body).toHaveProperty("id");
        expect(response.body.name).toBe(productData.name);
        expect(response.body.sku).toBe(productData.sku);
        productId = response.body.id;
      });

      it("should fail to create product as regular user", async () => {
        const productData = {
          name: "Test Product 2",
          description: "A test product description",
          price: 29.99,
          sku: "TEST-002",
          stock: 100,
        };

        await request(app.getHttpServer())
          .post("/api/v1/products")
          .set("Authorization", `Bearer ${authToken}`)
          .send(productData)
          .expect(403);
      });

      it("should fail with invalid SKU (duplicate)", async () => {
        const productData = {
          name: "Test Product 3",
          description: "A test product description",
          price: 29.99,
          sku: "TEST-001",
          stock: 100,
        };

        await request(app.getHttpServer())
          .post("/api/v1/products")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(productData)
          .expect(409);
      });
    });

    describe("GET /products", () => {
      it("should return paginated products", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/products?page=1&limit=10")
          .expect(200);

        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("meta");
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.meta).toHaveProperty("total");
        expect(response.body.meta).toHaveProperty("page", 1);
        expect(response.body.meta).toHaveProperty("limit", 10);
      });

      it("should filter products by search", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/products?search=Test")
          .expect(200);

        expect(response.body.data.length).toBeGreaterThan(0);
        response.body.data.forEach((product: any) => {
          expect(
            product.name.toLowerCase().includes("test") ||
              product.description.toLowerCase().includes("test"),
          ).toBe(true);
        });
      });

      it("should filter products by price range", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/products?minPrice=20&maxPrice=50")
          .expect(200);

        response.body.data.forEach((product: any) => {
          expect(product.price).toBeGreaterThanOrEqual(20);
          expect(product.price).toBeLessThanOrEqual(50);
        });
      });

      it("should filter products by in_stock", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/products?inStock=true")
          .expect(200);

        response.body.data.forEach((product: any) => {
          expect(product.stock).toBeGreaterThan(0);
        });
      });
    });

    describe("GET /products/:id", () => {
      it("should return product by ID", async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/products/${productId}`)
          .expect(200);

        expect(response.body).toHaveProperty("id", productId);
        expect(response.body).toHaveProperty("name");
        expect(response.body).toHaveProperty("price");
      });

      it("should return 404 for non-existent product", async () => {
        await request(app.getHttpServer())
          .get("/api/v1/products/non-existent-id")
          .expect(404);
      });
    });

    describe("PUT /products/:id (Admin only)", () => {
      it("should update product as admin", async () => {
        const updateData = {
          name: "Updated Product Name",
          price: 39.99,
        };

        const response = await request(app.getHttpServer())
          .put(`/api/v1/products/${productId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.name).toBe(updateData.name);
        expect(response.body.price).toBe(updateData.price);
      });

      it("should fail to update product as regular user", async () => {
        await request(app.getHttpServer())
          .put(`/api/v1/products/${productId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send({ name: "Hacked Name" })
          .expect(403);
      });
    });

    describe("DELETE /products/:id (Admin only)", () => {
      it("should delete product as admin", async () => {
        await request(app.getHttpServer())
          .delete(`/api/v1/products/${productId}`)
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);
      });

      it("should fail to delete product as regular user", async () => {
        await request(app.getHttpServer())
          .delete("/api/v1/products/some-id")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(403);
      });
    });
  });

  describe("Cart", () => {
    let authToken: string;
    let productId: string;

    beforeAll(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "cartuser@example.com",
          password: "SecurePass123!",
          firstName: "Cart",
          lastName: "User",
        });

      authToken = registerResponse.body.accessToken;

      const adminResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "admin@example.com",
          password: "AdminPass123!",
          firstName: "Admin",
          lastName: "User",
        });

      const adminToken = adminResponse.body.accessToken;

      await dataSource.query(
        `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`,
      );

      const productResponse = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Cart Test Product",
          description: "A product for cart testing",
          price: 29.99,
          sku: "CART-001",
          stock: 100,
        });

      productId = productResponse.body.id;
    });

    describe("POST /cart (Add item)", () => {
      it("should add item to cart", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            productId,
            quantity: 2,
          })
          .expect(201);

        expect(response.body).toHaveProperty("id");
        expect(response.body.productId).toBe(productId);
        expect(response.body.quantity).toBe(2);
      });

      it("should update quantity if item already exists", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ productId, quantity: 2 })
          .expect(201);

        await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ productId, quantity: 3 })
          .expect(201);

        const response = await request(app.getHttpServer())
          .get("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body[0].quantity).toBe(3);
      });
    });

    describe("GET /cart", () => {
      it("should return cart items", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      });

      it("should return empty cart for new user", async () => {
        const registerResponse = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send({
            email: "emptycart@example.com",
            password: "SecurePass123!",
            firstName: "Empty",
            lastName: "Cart",
          });

        const response = await request(app.getHttpServer())
          .get("/api/v1/cart")
          .set("Authorization", `Bearer ${registerResponse.body.accessToken}`)
          .expect(200);

        expect(response.body).toEqual([]);
      });
    });

    describe("PUT /cart/:id (Update quantity)", () => {
      let cartItemId: string;

      beforeEach(async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ productId, quantity: 1 });

        cartItemId = response.body.id;
      });

      it("should update cart item quantity", async () => {
        const response = await request(app.getHttpServer())
          .put(`/api/v1/cart/${cartItemId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send({ quantity: 5 })
          .expect(200);

        expect(response.body.quantity).toBe(5);
      });
    });

    describe("DELETE /cart/:id (Remove item)", () => {
      let cartItemId: string;

      beforeEach(async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ productId, quantity: 1 });

        cartItemId = response.body.id;
      });

      it("should remove item from cart", async () => {
        await request(app.getHttpServer())
          .delete(`/api/v1/cart/${cartItemId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        const cartResponse = await request(app.getHttpServer())
          .get("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        const item = cartResponse.body.find(
          (item: any) => item.id === cartItemId,
        );
        expect(item).toBeUndefined();
      });
    });

    describe("DELETE /cart (Clear cart)", () => {
      it("should clear all cart items", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({ productId, quantity: 1 });

        await request(app.getHttpServer())
          .delete("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        const response = await request(app.getHttpServer())
          .get("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toEqual([]);
      });
    });
  });

  describe("Orders", () => {
    let authToken: string;
    let adminToken: string;
    let productId: string;
    let orderId: string;

    beforeAll(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "orderuser@example.com",
          password: "SecurePass123!",
          firstName: "Order",
          lastName: "User",
        });

      authToken = registerResponse.body.accessToken;

      const adminRegisterResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "orderadmin@example.com",
          password: "AdminPass123!",
          firstName: "Order",
          lastName: "Admin",
        });

      adminToken = adminRegisterResponse.body.accessToken;

      await dataSource.query(
        `UPDATE users SET role = 'admin' WHERE email = 'orderadmin@example.com'`,
      );

      const productResponse = await request(app.getHttpServer())
        .post("/api/v1/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Order Test Product",
          description: "A product for order testing",
          price: 50.0,
          sku: "ORDER-001",
          stock: 100,
        });

      productId = productResponse.body.id;
    });

    describe("POST /orders", () => {
      it("should create an order from cart", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            productId,
            quantity: 2,
          });

        const orderData = {
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

        const response = await request(app.getHttpServer())
          .post("/api/v1/orders")
          .set("Authorization", `Bearer ${authToken}`)
          .send(orderData)
          .expect(201);

        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("orderNumber");
        expect(response.body).toHaveProperty("status", "pending");
        expect(response.body).toHaveProperty("total");
        expect(response.body.total).toBe(100);
        orderId = response.body.id;
      });

      it("should fail with empty cart", async () => {
        const newToken = (
          await request(app.getHttpServer())
            .post("/api/v1/auth/register")
            .send({
              email: "emptyorder@example.com",
              password: "SecurePass123!",
              firstName: "Empty",
              lastName: "Order",
            })
        ).body.accessToken;

        await request(app.getHttpServer())
          .post("/api/v1/orders")
          .set("Authorization", `Bearer ${newToken}`)
          .send({
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
          })
          .expect(400);
      });

      it("should calculate tax correctly", async () => {
        await request(app.getHttpServer())
          .post("/api/v1/cart")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
            productId,
            quantity: 1,
          });

        const response = await request(app.getHttpServer())
          .post("/api/v1/orders")
          .set("Authorization", `Bearer ${authToken}`)
          .send({
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

        expect(response.body.subtotal).toBe(50);
        expect(response.body.tax).toBe(4);
        expect(response.body.total).toBe(54);
      });
    });

    describe("GET /orders", () => {
      it("should return user orders", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/orders")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("meta");
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it("should filter orders by status", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/orders?status=pending")
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        response.body.data.forEach((order: any) => {
          expect(order.status).toBe("pending");
        });
      });
    });

    describe("GET /orders/:id", () => {
      it("should return order by ID", async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("id", orderId);
        expect(response.body).toHaveProperty("items");
        expect(Array.isArray(response.body.items)).toBe(true);
      });

      it("should fail to access another user order", async () => {
        const otherUserToken = (
          await request(app.getHttpServer())
            .post("/api/v1/auth/register")
            .send({
              email: "otheruser@example.com",
              password: "SecurePass123!",
              firstName: "Other",
              lastName: "User",
            })
        ).body.accessToken;

        await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .set("Authorization", `Bearer ${otherUserToken}`)
          .expect(404);
      });
    });

    describe("POST /orders/:id/cancel", () => {
      it("should cancel pending order", async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set("Authorization", `Bearer ${authToken}`)
          .send({ reason: "Changed mind" })
          .expect(200);

        const response = await request(app.getHttpServer())
          .get(`/api/v1/orders/${orderId}`)
          .set("Authorization", `Bearer ${authToken}`);

        expect(response.body.status).toBe("cancelled");
        expect(response.body.cancellationReason).toBe("Changed mind");
      });

      it("should fail to cancel already cancelled order", async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/orders/${orderId}/cancel`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(400);
      });
    });
  });

  describe("Coupons", () => {
    let adminToken: string;

    beforeAll(async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: "couponadmin@example.com",
          password: "AdminPass123!",
          firstName: "Coupon",
          lastName: "Admin",
        });

      adminToken = response.body.accessToken;

      await dataSource.query(
        `UPDATE users SET role = 'admin' WHERE email = 'couponadmin@example.com'`,
      );
    });

    describe("POST /coupons (Admin only)", () => {
      it("should create a new coupon", async () => {
        const couponData = {
          code: "SUMMER20",
          discountType: "percentage",
          discountValue: 20,
          minOrderAmount: 50,
          maxUses: 100,
          maxUsesPerUser: 5,
          validFrom: new Date().toISOString(),
          validUntil: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        };

        const response = await request(app.getHttpServer())
          .post("/api/v1/coupons")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(couponData)
          .expect(201);

        expect(response.body).toHaveProperty("id");
        expect(response.body.code).toBe(couponData.code.toUpperCase());
        expect(response.body.usedCount).toBe(0);
      });

      it("should fail with duplicate coupon code", async () => {
        const couponData = {
          code: "SUMMER20",
          discountType: "percentage",
          discountValue: 20,
        };

        await request(app.getHttpServer())
          .post("/api/v1/coupons")
          .set("Authorization", `Bearer ${adminToken}`)
          .send(couponData)
          .expect(409);
      });
    });

    describe("GET /coupons", () => {
      it("should return all coupons (admin)", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/coupons")
          .set("Authorization", `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("meta");
        expect(Array.isArray(response.body.data)).toBe(true);
      });
    });

    describe("GET /coupons/:id", () => {
      it("should return coupon by ID", async () => {
        const coupons = await request(app.getHttpServer())
          .get("/api/v1/coupons")
          .set("Authorization", `Bearer ${adminToken}`);

        if (coupons.body.data.length > 0) {
          const couponId = coupons.body.data[0].id;

          const response = await request(app.getHttpServer())
            .get(`/api/v1/coupons/${couponId}`)
            .set("Authorization", `Bearer ${adminToken}`)
            .expect(200);

          expect(response.body).toHaveProperty("id", couponId);
          expect(response.body).toHaveProperty("code");
          expect(response.body).toHaveProperty("discountValue");
        }
      });
    });
  });

  describe("Rate Limiting", () => {
    it("should allow requests within limit", async () => {
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer()).get("/health").expect(200);
      }
    });

    it.skip("should rate limit excessive requests", async () => {
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/v1/auth/register")
            .send({
              email: `test${i}@example.com`,
              password: "SecurePass123!",
              firstName: "Test",
              lastName: "User",
            }),
        );
      }

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter((r) => r.status === 429);

      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should return 404 for non-existent route", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/non-existent-route")
        .expect(404);
    });

    it("should return 401 for unauthorized access", async () => {
      await request(app.getHttpServer()).get("/api/v1/orders").expect(401);
    });

    it("should return 403 for forbidden access", async () => {
      const userToken = (
        await request(app.getHttpServer()).post("/api/v1/auth/register").send({
          email: "forbidden@example.com",
          password: "SecurePass123!",
          firstName: "Forbidden",
          lastName: "User",
        })
      ).body.accessToken;

      await request(app.getHttpServer())
        .get("/api/v1/admin/dashboard")
        .set("Authorization", `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
