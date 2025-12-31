import {
  User,
  Role,
  AuthProvider,
} from "../../src/database/entities/user.entity";
import {
  Product,
  ProductStatus,
} from "../../src/database/entities/product.entity";
import { Category } from "../../src/database/entities/category.entity";
import { Order, OrderStatus } from "../../src/database/entities/order.entity";
import {
  Coupon,
  CouponStatus,
  DiscountType,
} from "../../src/database/entities/coupon.entity";
import { Address } from "../../src/database/entities/address.entity";
import { Review } from "../../src/database/entities/review.entity";
import * as bcrypt from "bcrypt";

export class TestFactory {
  static async createUser(
    overrides: Partial<User> = {},
  ): Promise<Partial<User>> {
    return {
      email: `user-${Date.now()}@example.com`,
      firstName: "Test",
      lastName: "User",
      password: await bcrypt.hash("SecurePass123!", 12),
      role: Role.CUSTOMER,
      authProvider: AuthProvider.LOCAL,
      isActive: true,
      isEmailVerified: true,
      ...overrides,
    };
  }

  static async createAdmin(
    overrides: Partial<User> = {},
  ): Promise<Partial<User>> {
    return this.createUser({
      role: Role.ADMIN,
      email: `admin-${Date.now()}@example.com`,
      ...overrides,
    });
  }

  static createProduct(overrides: Partial<Product> = {}): Partial<Product> {
    return {
      name: `Test Product ${Date.now()}`,
      description: "A test product",
      price: 29.99,
      sku: `SKU-${Date.now()}`,
      stock: 100,
      lowStockThreshold: 10,
      status: ProductStatus.ACTIVE,
      taxable: true,
      taxClass: "standard",
      images: [],
      ...overrides,
    };
  }

  static createCategory(overrides: Partial<Category> = {}): Partial<Category> {
    return {
      name: `Category ${Date.now()}`,
      slug: `category-${Date.now()}`,
      description: "A test category",
      ...overrides,
    };
  }

  static createOrder(overrides: Partial<Order> = {}): Partial<Order> {
    return {
      orderNumber: `ORD-${Date.now()}`,
      userId: "",
      status: OrderStatus.PENDING,
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
      ...overrides,
    };
  }

  static createCoupon(overrides: Partial<Coupon> = {}): Partial<Coupon> {
    return {
      code: `COUPON-${Date.now()}`,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      minOrderAmount: 50,
      maxUses: 100,
      maxUsesPerUser: 5,
      status: CouponStatus.ACTIVE,
      ...overrides,
    };
  }

  static createAddress(overrides: Partial<Address> = {}): Partial<Address> {
    return {
      userId: "",
      firstName: "John",
      lastName: "Doe",
      street: "123 Main St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      country: "USA",
      phone: "+1234567890",
      isDefault: true,
      ...overrides,
    };
  }

  static createReview(overrides: Partial<Review> = {}): Partial<Review> {
    return {
      userId: "",
      productId: "",
      rating: 5,
      comment: "Great product!",
      isVerifiedPurchase: true,
      isApproved: true,
      ...overrides,
    };
  }
}
