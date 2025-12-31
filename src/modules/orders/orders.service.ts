import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Order, OrderStatus } from "../../database/entities/order.entity";
import { validateOrderStatusTransition } from "../../common/decorators/validate-status-transition.decorator";
import { OrderItem } from "../../database/entities/order-item.entity";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../database/entities/payment.entity";
import { Product, ProductStatus } from "../../database/entities/product.entity";
import { ProductVariant } from "../../database/entities/product-variant.entity";
import { CartItem } from "../../database/entities/cart-item.entity";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderFilterDto } from "./dto/order-filter.dto";
import { v4 as uuidv4 } from "uuid";
import { LoggerServiceImpl as CustomLogger } from "../../common/logger/logger.service";

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly logger: CustomLogger,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    // Start transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get cart items
      const cartItems = await queryRunner.manager.find(CartItem, {
        where: { userId },
        relations: ["product", "variant"],
      });

      if (cartItems.length === 0) {
        throw new BadRequestException("Cart is empty");
      }

      // Validate cart items and calculate totals
      const orderItems: Partial<OrderItem>[] = [];
      let subtotal = 0;

      for (const cartItem of cartItems) {
        if (
          !cartItem.product ||
          cartItem.product.status !== ProductStatus.ACTIVE
        ) {
          throw new BadRequestException(
            `Product ${cartItem.productId} is not available`,
          );
        }

        const price = cartItem.variant?.price ?? cartItem.product.price;
        const itemTotal = price * cartItem.quantity;
        subtotal += itemTotal;

        if (
          cartItem.quantity >
          (cartItem.variant?.stock ?? cartItem.product.stock)
        ) {
          throw new BadRequestException(
            `Insufficient stock for ${cartItem.product.name}. Available: ${cartItem.variant?.stock ?? cartItem.product.stock}`,
          );
        }

        orderItems.push({
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          name: cartItem.product.name,
          sku: cartItem.variant?.sku ?? cartItem.product.sku,
          unitPrice: price,
          quantity: cartItem.quantity,
          total: itemTotal,
          productSnapshot: JSON.stringify({
            name: cartItem.product.name,
            image: cartItem.product.images?.[0],
            variant: cartItem.variant?.name,
          }),
        });

        // Deduct stock
        if (cartItem.variant) {
          await queryRunner.manager.decrement(
            ProductVariant,
            { id: cartItem.variantId },
            "stock",
            cartItem.quantity,
          );
        } else {
          await queryRunner.manager.decrement(
            Product,
            { id: cartItem.productId },
            "stock",
            cartItem.quantity,
          );
        }

        // Update sold count
        await queryRunner.manager.increment(
          Product,
          { id: cartItem.productId },
          "soldCount",
          cartItem.quantity,
        );
      }

      // Calculate totals
      const taxRate = this.configService.get<number>("TAX_RATE", 0.08);
      const shippingCost = this.configService.get<number>("SHIPPING_COST", 10);
      const freeShippingThreshold = this.configService.get<number>(
        "FREE_SHIPPING_THRESHOLD",
        100,
      );
      const tax = Math.round(subtotal * taxRate * 100) / 100;
      const finalShippingCost =
        subtotal >= freeShippingThreshold ? 0 : shippingCost;
      const discount = createOrderDto.couponCode
        ? await this.applyCoupon(createOrderDto.couponCode, subtotal)
        : 0;
      const total =
        Math.round((subtotal + tax + shippingCost - discount) * 100) / 100;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

      // Create order
      const order = queryRunner.manager.create(Order, {
        orderNumber,
        userId,
        status: OrderStatus.PENDING,
        subtotal,
        tax,
        shippingCost: finalShippingCost,
        discount,
        total,
        shippingAddress: createOrderDto.shippingAddress,
        billingAddress:
          createOrderDto.billingAddress || createOrderDto.shippingAddress,
        notes: createOrderDto.notes,
      });

      const savedOrder = await queryRunner.manager.save(order);

      // Create order items
      const orderItemEntities = orderItems.map((item) =>
        queryRunner.manager.create(OrderItem, {
          ...item,
          orderId: savedOrder.id,
        }),
      );
      await queryRunner.manager.save(orderItemEntities);

      // Create initial payment record
      const payment = queryRunner.manager.create(Payment, {
        orderId: savedOrder.id,
        amount: total,
        currency: "USD",
        paymentMethod: createOrderDto.paymentMethod || PaymentMethod.STRIPE,
        paymentStatus: PaymentStatus.PENDING,
        description: `Payment for order ${orderNumber}`,
      });
      await queryRunner.manager.save(payment);

      // Clear cart
      await queryRunner.manager.delete(CartItem, { userId });

      // Commit transaction
      await queryRunner.commitTransaction();

      this.logger.log(
        `Order created: ${orderNumber} by user ${userId}`,
        "OrdersService",
      );

      // Return order with relations
      return this.findOne(savedOrder.id, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(userId: string, filterDto: OrderFilterDto) {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filterDto;

    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.items", "items")
      .where("order.userId = :userId", { userId });

    if (status) {
      queryBuilder.andWhere("order.status = :status", { status });
    }

    queryBuilder.orderBy(`order.${sortBy}`, sortOrder);

    const [orders, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(orderId: string, userId?: string): Promise<Order> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("items.product", "product")
      .leftJoinAndSelect("items.variant", "variant")
      .leftJoinAndSelect("order.payments", "payments")
      .where("order.id = :orderId", { orderId });

    if (userId) {
      queryBuilder.andWhere("order.userId = :userId", { userId });
    }

    const order = await queryBuilder.getOne();

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
      relations: ["items", "payments"],
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderNumber} not found`);
    }

    return order;
  }

  async cancel(
    userId: string,
    orderId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.findOne(orderId, userId);

    if (![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new BadRequestException(
        "Order cannot be cancelled in current status",
      );
    }

    // Start transaction to restore stock
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Restore stock for each item
      for (const item of order.items) {
        if (item.variant) {
          await queryRunner.manager.increment(
            ProductVariant,
            { id: item.variantId },
            "stock",
            item.quantity,
          );
        } else {
          await queryRunner.manager.increment(
            Product,
            { id: item.productId },
            "stock",
            item.quantity,
          );
        }

        // Reverse sold count
        await queryRunner.manager.decrement(
          Product,
          { id: item.productId },
          "soldCount",
          item.quantity,
        );
      }

      // Update order status
      order.status = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      order.cancellationReason = reason || "";
      await queryRunner.manager.save(order);

      // Update payment status if exists
      if (order.payments?.length > 0) {
        const payment = order.payments.find(
          (p) => p.paymentStatus === PaymentStatus.COMPLETED,
        );
        if (payment) {
          payment.paymentStatus = PaymentStatus.REFUNDED;
          payment.refundedAt = new Date();
          payment.refundReason = reason || "";
          await queryRunner.manager.save(payment);
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Order ${order.orderNumber} cancelled`, "OrdersService");
      return this.findOne(orderId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateStatus(
    orderId: string,
    status: OrderStatus,
    additionalData?: { trackingNumber?: string; notes?: string },
  ): Promise<Order> {
    const order = await this.findOne(orderId);

    const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUNDED]: [],
      [OrderStatus.RETURNED]: [],
    };

    if (
      !statusTransitions[order.status].includes(status) &&
      order.status !== status
    ) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${status}`,
      );
    }

    order.status = status;

    if (additionalData?.trackingNumber) {
      order.trackingNumber = additionalData.trackingNumber;
    }

    if (additionalData?.notes) {
      order.notes = additionalData.notes;
    }

    if (status === OrderStatus.SHIPPED) {
      order.shippedAt = new Date();
    }

    if (status === OrderStatus.DELIVERED) {
      order.deliveredAt = new Date();
    }

    await this.orderRepository.save(order);

    this.logger.log(
      `Order ${order.orderNumber} status updated to ${status}`,
      "OrdersService",
    );
    return order;
  }

  async getUserOrderStats(userId: string) {
    const totalOrders = await this.orderRepository.count({
      where: { userId },
    });

    const totalSpent = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.total)", "total")
      .where("order.userId = :userId", { userId })
      .andWhere("order.status != :status", { status: OrderStatus.CANCELLED })
      .getRawOne();

    const pendingOrders = await this.orderRepository.count({
      where: { userId, status: OrderStatus.PENDING },
    });

    const deliveredOrders = await this.orderRepository.count({
      where: { userId, status: OrderStatus.DELIVERED },
    });

    return {
      totalOrders,
      totalSpent: parseFloat(totalSpent?.total || "0"),
      pendingOrders,
      deliveredOrders,
    };
  }

  // ========================================
  // Admin/Seller Methods
  // ========================================

  async findAllAdmin(filterDto: OrderFilterDto) {
    const {
      page = 1,
      limit = 10,
      status,
      userId,
      sortBy = "createdAt",
      sortOrder = "DESC",
    } = filterDto;

    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("order.user", "user");

    if (status) {
      queryBuilder.andWhere("order.status = :status", { status });
    }

    if (userId) {
      queryBuilder.andWhere("order.userId = :userId", { userId });
    }

    queryBuilder.orderBy(`order.${sortBy}`, sortOrder);

    const [orders, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderStats() {
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue,
    ] = await Promise.all([
      this.orderRepository.count(),
      this.orderRepository.count({ where: { status: OrderStatus.PENDING } }),
      this.orderRepository.count({ where: { status: OrderStatus.PROCESSING } }),
      this.orderRepository.count({ where: { status: OrderStatus.SHIPPED } }),
      this.orderRepository.count({ where: { status: OrderStatus.DELIVERED } }),
      this.orderRepository.count({ where: { status: OrderStatus.CANCELLED } }),
      this.orderRepository
        .createQueryBuilder("order")
        .select("SUM(order.total)", "total")
        .where("order.status != :status", { status: OrderStatus.CANCELLED })
        .getRawOne(),
    ]);

    return {
      totalOrders,
      byStatus: {
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      totalRevenue: parseFloat(totalRevenue?.total || "0"),
    };
  }

  private async applyCoupon(
    couponCode: string,
    subtotal: number,
  ): Promise<number> {
    // TODO: Implement coupon logic
    // For now, return 0
    return 0;
  }
}
