import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Coupon,
  CouponStatus,
  DiscountType,
} from "../../database/entities/coupon.entity";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { LoggerServiceImpl as CustomLogger } from "../../common/logger/logger.service";

@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    private readonly logger: CustomLogger,
  ) {}

  async create(createCouponDto: CreateCouponDto): Promise<Coupon> {
    const existingCoupon = await this.couponRepository.findOne({
      where: { code: createCouponDto.code },
    });

    if (existingCoupon) {
      throw new BadRequestException("Coupon code already exists");
    }

    const coupon = this.couponRepository.create({
      ...createCouponDto,
      usedCount: 0,
      status: CouponStatus.ACTIVE,
    });

    await this.couponRepository.save(coupon);
    this.logger.log(`Coupon created: ${coupon.code}`, "CouponsService");
    return coupon;
  }

  async findAll(page = 1, limit = 10, status?: CouponStatus) {
    const queryBuilder = this.couponRepository.createQueryBuilder("coupon");

    if (status) {
      queryBuilder.andWhere("coupon.status = :status", { status });
    }

    const [coupons, total] = await queryBuilder
      .orderBy("coupon.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: coupons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });

    if (!coupon) {
      throw new NotFoundException("Coupon not found");
    }

    return coupon;
  }

  async findByCode(code: string): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      throw new NotFoundException("Invalid coupon code");
    }

    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new BadRequestException("Coupon is not active");
    }

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      throw new BadRequestException("Coupon is not yet valid");
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      throw new BadRequestException("Coupon has expired");
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException("Coupon usage limit reached");
    }

    return coupon;
  }

  async update(
    id: string,
    updateCouponDto: Partial<CreateCouponDto>,
  ): Promise<Coupon> {
    const coupon = await this.findOne(id);

    Object.assign(coupon, updateCouponDto);
    await this.couponRepository.save(coupon);

    this.logger.log(`Coupon updated: ${coupon.code}`, "CouponsService");
    return coupon;
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findOne(id);
    await this.couponRepository.remove(coupon);
    this.logger.log(`Coupon deleted: ${coupon.code}`, "CouponsService");
  }

  async applyCoupon(
    code: string,
    subtotal: number,
    userId: string,
    productIds?: string[],
    categoryIds?: string[],
  ): Promise<{ discount: number; couponId: string; freeShipping: boolean }> {
    const coupon = await this.findByCode(code);

    if (coupon.minOrderAmount && subtotal < coupon.minOrderAmount) {
      throw new BadRequestException(
        `Minimum order amount of $${coupon.minOrderAmount} required for this coupon`,
      );
    }

    if (coupon.maxUsesPerUser > 0) {
      const userUses = await this.getUserCouponUses(coupon.id, userId);
      if (userUses >= coupon.maxUsesPerUser) {
        throw new BadRequestException(
          `You have reached the maximum usage limit for this coupon`,
        );
      }
    }

    if (coupon.applicableCategories?.length > 0) {
      if (
        !categoryIds ||
        !categoryIds.some((id) => coupon.applicableCategories.includes(id))
      ) {
        throw new BadRequestException(
          "Coupon not applicable to these products",
        );
      }
    }

    if (coupon.applicableProducts?.length > 0) {
      if (
        !productIds ||
        !productIds.some((id) => coupon.applicableProducts.includes(id))
      ) {
        throw new BadRequestException(
          "Coupon not applicable to these products",
        );
      }
    }

    let discount = 0;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discount = subtotal * (coupon.discountValue / 100);
    } else {
      discount = coupon.discountValue;
    }

    return {
      discount: Math.min(discount, subtotal),
      couponId: coupon.id,
      freeShipping: coupon.freeShipping,
    };
  }

  async incrementUsage(couponId: string): Promise<void> {
    await this.couponRepository.increment({ id: couponId }, "usedCount", 1);
  }

  async deactivateExpiredCoupons(): Promise<void> {
    const now = new Date();
    await this.couponRepository
      .createQueryBuilder()
      .update(Coupon)
      .set({ status: CouponStatus.EXPIRED })
      .where("status = :status", { status: CouponStatus.ACTIVE })
      .andWhere("validUntil < :now", { now })
      .execute();

    this.logger.log("Expired coupons deactivated", "CouponsService");
  }

  private async getUserCouponUses(
    couponId: string,
    userId: string,
  ): Promise<number> {
    const { Order } = await import("../../database/entities");
    const query = this.couponRepository.manager
      .createQueryBuilder(Order, "order")
      .leftJoin("order.items", "items")
      .where("order.couponId = :couponId", { couponId })
      .andWhere("order.userId = :userId", { userId })
      .andWhere("order.status != :status", { status: "cancelled" });

    return await query.getCount();
  }
}
