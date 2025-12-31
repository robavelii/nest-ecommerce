import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { User, Role } from "../../database/entities/user.entity";
import { validateOrderStatusTransition } from "../../common/decorators/validate-status-transition.decorator";
import { Product } from "../../database/entities/product.entity";
import { Order, OrderStatus } from "../../database/entities/order.entity";
import { Category } from "../../database/entities/category.entity";
import { Review } from "../../database/entities/review.entity";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { AdminDashboardDto } from "./dto/admin-dashboard.dto";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async getDashboardStats(): Promise<AdminDashboardDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalReviews,
      monthlyUsers,
      previousMonthUsers,
      monthlyOrders,
      previousMonthOrders,
      monthlyRevenue,
      previousMonthRevenue,
      recentOrders,
      topProducts,
      ordersByStatus,
    ] = await Promise.all([
      // Total counts
      this.userRepository.count(),
      this.productRepository.count(),
      this.orderRepository.count(),
      this.reviewRepository.count(),

      // Monthly users
      this.userRepository.count({
        where: { createdAt: Between(startOfMonth, now) },
      }),
      this.userRepository.count({
        where: { createdAt: Between(startOfPreviousMonth, endOfPreviousMonth) },
      }),

      // Monthly orders
      this.orderRepository.count({
        where: { createdAt: Between(startOfMonth, now) },
      }),
      this.orderRepository.count({
        where: { createdAt: Between(startOfPreviousMonth, endOfPreviousMonth) },
      }),

      // Monthly revenue
      this.orderRepository
        .createQueryBuilder("order")
        .select("SUM(order.total)", "total")
        .where("order.createdAt BETWEEN :start AND :end", {
          start: startOfMonth,
          end: now,
        })
        .andWhere("order.status != :status", { status: OrderStatus.CANCELLED })
        .getRawOne(),

      this.orderRepository
        .createQueryBuilder("order")
        .select("SUM(order.total)", "total")
        .where("order.createdAt BETWEEN :start AND :end", {
          start: startOfPreviousMonth,
          end: endOfPreviousMonth,
        })
        .andWhere("order.status != :status", { status: OrderStatus.CANCELLED })
        .getRawOne(),

      // Recent orders (use QueryBuilder because nested `select` with relations
      // is not supported by TypeORM find options and can generate invalid SQL)
      this.orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.user", "user")
        .select([
          "order.id",
          "order.total",
          "order.status",
          "order.createdAt",
          "user.id",
          "user.firstName",
          "user.lastName",
          "user.email",
        ])
        .orderBy("order.createdAt", "DESC")
        .take(10)
        .getMany(),

      // Top products by order volume
      this.orderRepository
        .createQueryBuilder("order")
        .leftJoin("order.items", "item")
        .leftJoin("item.product", "product")
        .select("product.id", "productId")
        .addSelect("product.name", "productName")
        .addSelect("SUM(item.quantity)", "total_sold")
        .addSelect("SUM(item.quantity * item.unit_price)", "revenue")
        .groupBy("product.id")
        .orderBy("total_sold", "DESC")
        .limit(5)
        .getRawMany(),

      // Orders by status
      this.orderRepository
        .createQueryBuilder("order")
        .select("order.status", "status")
        .addSelect("COUNT(*)", "count")
        .groupBy("order.status")
        .getRawMany(),
    ]);

    // Calculate growth percentages
    const userGrowth =
      previousMonthUsers > 0
        ? ((monthlyUsers - previousMonthUsers) / previousMonthUsers) * 100
        : 0;

    const orderGrowth =
      previousMonthOrders > 0
        ? ((monthlyOrders - previousMonthOrders) / previousMonthOrders) * 100
        : 0;

    const revenueGrowth =
      previousMonthRevenue?.total > 0
        ? ((monthlyRevenue?.total - previousMonthRevenue.total) /
            previousMonthRevenue.total) *
          100
        : 0;

    // Normalize topProducts aliases returned by getRawMany()
    const mappedTopProducts = (topProducts || []).map((p: any) => ({
      productId: p.productid ?? p.productId ?? p.product_id,
      productName: p.productname ?? p.productName ?? p.product_name,
      totalSold: Number(p.total_sold ?? p.totalsold ?? p.totalSold ?? 0),
      revenue: Number(p.revenue ?? 0),
    }));

    return {
      totalUsers,
      totalProducts,
      totalOrders,
      totalReviews,
      monthlyUsers,
      userGrowth: Number(userGrowth.toFixed(2)),
      monthlyOrders,
      orderGrowth: Number(orderGrowth.toFixed(2)),
      monthlyRevenue: Number(monthlyRevenue?.total || 0),
      revenueGrowth: Number(revenueGrowth.toFixed(2)),
      recentOrders,
      topProducts: mappedTopProducts,
      ordersByStatus: ordersByStatus.map((item) => ({
        status: item.status,
        count: Number(item.count),
      })),
    };
  }

  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    role?: Role,
  ): Promise<{
    data: User[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.userRepository
      .createQueryBuilder("u")
      .select([
        "u.id",
        "u.firstName",
        "u.lastName",
        "u.email",
        "u.role",
        "u.isActive",
        "u.createdAt",
        "u.authProvider",
      ]);

    if (search) {
      queryBuilder.andWhere(
        "(u.firstName ILIKE :search OR u.lastName ILIKE :search OR u.email ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere("u.role = :role", { role });
    }

    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const users = await queryBuilder
      .orderBy("u.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      data: users,
      total,
      page,
      totalPages,
    };
  }

  async updateUserRole(
    userId: string,
    updateUserRoleDto: UpdateUserRoleDto,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN && updateUserRoleDto.role !== Role.ADMIN) {
      // Check if this is the last admin
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException("Cannot remove the last admin user");
      }
    }

    user.role = updateUserRoleDto.role;
    user.isActive = updateUserRoleDto.isActive;

    return this.userRepository.save(user);
  }

  async deactivateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException("Cannot deactivate the last admin user");
      }
    }

    user.isActive = false;
    return this.userRepository.save(user);
  }

  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: OrderStatus,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    data: Order[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.user", "user")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("items.product", "product")
      .select([
        "order.id",
        "order.total",
        "order.status",
        "order.createdAt",
        "order.updatedAt",
        "user.id",
        "user.firstName",
        "user.lastName",
        "user.email",
        "items.id",
        "items.quantity",
        "items.unitPrice",
        "product.id",
        "product.name",
      ]);

    if (status) {
      queryBuilder.andWhere("order.status = :status", { status });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere("order.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const orders = await queryBuilder
      .orderBy("order.createdAt", "DESC")
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      data: orders,
      total,
      page,
      totalPages,
    };
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ["user", "items", "items.product"],
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    validateOrderStatusTransition(order.status, status);

    order.status = status;
    return this.orderRepository.save(order);
  }

  async getOrderAnalytics(
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    dailyStats: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
  }> {
    const dailyStatsQuery = await this.orderRepository
      .createQueryBuilder("order")
      .select("DATE(order.createdAt)", "date")
      .addSelect("SUM(order.total)", "revenue")
      .addSelect("COUNT(*)", "orders")
      .where("order.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
      .andWhere("order.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("DATE(order.createdAt)")
      .orderBy("date", "ASC")
      .getRawMany();

    const totalStatsQuery = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.total)", "totalRevenue")
      .addSelect("COUNT(*)", "totalOrders")
      .addSelect("AVG(order.total)", "averageOrderValue")
      .where("order.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
      .andWhere("order.status != :status", { status: OrderStatus.CANCELLED })
      .getRawOne();

    return {
      totalRevenue: Number(totalStatsQuery.totalRevenue || 0),
      totalOrders: Number(totalStatsQuery.totalOrders || 0),
      averageOrderValue: Number(totalStatsQuery.averageOrderValue || 0),
      dailyStats: dailyStatsQuery.map((stat) => ({
        date: stat.date,
        revenue: Number(stat.revenue),
        orders: Number(stat.orders),
      })),
    };
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === Role.ADMIN) {
      const adminCount = await this.userRepository.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException("Cannot delete the last admin user");
      }
    }

    await this.userRepository.remove(user);
  }
}
