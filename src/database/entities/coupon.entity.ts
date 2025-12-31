import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum DiscountType {
  PERCENTAGE = "percentage",
  FIXED_AMOUNT = "fixed_amount",
}

export enum CouponStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  EXPIRED = "expired",
}

@Entity("coupons")
@Index(["code"])
@Index(["status"])
@Index(["validFrom", "validUntil"])
export class Coupon {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({
    type: "enum",
    enum: DiscountType,
    default: DiscountType.PERCENTAGE,
  })
  discountType: DiscountType;

  @Column({ type: "decimal", precision: 5, scale: 2 })
  discountValue: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  minOrderAmount: number;

  @Column({ default: 1, name: "max_uses" })
  maxUses: number;

  @Column({ default: 0, name: "used_count" })
  usedCount: number;

  @Column({ default: 1, name: "max_uses_per_user" })
  maxUsesPerUser: number;

  @Column({ name: "valid_from", nullable: true })
  validFrom: Date;

  @Column({ name: "valid_until", nullable: true })
  validUntil: Date;

  @Column({
    type: "enum",
    enum: CouponStatus,
    default: CouponStatus.ACTIVE,
  })
  status: CouponStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({
    type: "simple-array",
    nullable: true,
    name: "applicable_categories",
  })
  applicableCategories: string[];

  @Column({ type: "simple-array", nullable: true, name: "applicable_products" })
  applicableProducts: string[];

  @Column({ default: false, name: "free_shipping" })
  freeShipping: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
