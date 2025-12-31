import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Order } from "./order.entity";

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CREDIT_CARD = "credit_card",
  DEBIT_CARD = "debit_card",
  PAYPAL = "paypal",
  BANK_TRANSFER = "bank_transfer",
  STRIPE = "stripe",
  CASH_ON_DELIVERY = "cash_on_delivery",
}

@Entity("payments")
@Index(["orderId"])
@Index(["stripePaymentIntentId"])
@Index(["paymentStatus"])
export class Payment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "order_id" })
  orderId: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  currency: string;

  @Column({
    type: "enum",
    enum: PaymentMethod,
    default: PaymentMethod.STRIPE,
    name: "payment_method",
  })
  paymentMethod: PaymentMethod;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    name: "payment_status",
  })
  paymentStatus: PaymentStatus;

  @Column({ nullable: true, name: "transaction_id" })
  transactionId: string;

  @Column({ nullable: true, name: "stripe_payment_intent_id" })
  stripePaymentIntentId: string;

  @Column({ nullable: true, name: "stripe_charge_id" })
  stripeChargeId: string;

  @Column({ type: "text", nullable: true })
  metadata: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ nullable: true, name: "receipt_url" })
  receiptUrl: string;

  @Column({ nullable: true, name: "refunded_at" })
  refundedAt: Date;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
    name: "refund_amount",
  })
  refundAmount: number;

  @Column({ nullable: true, name: "refund_reason" })
  refundReason: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: Order;
}
