import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { OrderItem } from "./order-item.entity";
import { Payment } from "./payment.entity";

export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
  RETURNED = "returned",
}

@Entity("orders")
@Index(["orderNumber"])
@Index(["userId"])
@Index(["status"])
@Index(["createdAt"])
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true, name: "order_number" })
  orderNumber: string;

  @Column({ name: "user_id" })
  userId: string;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  tax: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
    name: "shipping_cost",
  })
  shippingCost: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total: number;

  @Column({ type: "jsonb", name: "shipping_address" })
  shippingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  };

  @Column({ type: "jsonb", name: "billing_address", nullable: true })
  billingAddress: {
    firstName: string;
    lastName: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone: string;
  };

  @Column({ type: "text", nullable: true })
  notes: string;

  @Column({ nullable: true, name: "tracking_number" })
  trackingNumber: string;

  @Column({ nullable: true, name: "shipped_at" })
  shippedAt: Date;

  @Column({ nullable: true, name: "delivered_at" })
  deliveredAt: Date;

  @Column({ nullable: true, name: "cancelled_at" })
  cancelledAt: Date;

  @Column({ nullable: true, name: "cancellation_reason" })
  cancellationReason: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.orders, { onDelete: "SET NULL" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];
}
