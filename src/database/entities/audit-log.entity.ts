import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

export enum AuditAction {
  LOGIN = "login",
  LOGOUT = "logout",
  REGISTER = "register",
  PASSWORD_CHANGE = "password_change",
  PASSWORD_RESET = "password_reset",
  ORDER_CREATED = "order_created",
  ORDER_CANCELLED = "order_cancelled",
  ORDER_STATUS_CHANGE = "order_status_change",
  PAYMENT_PROCESSED = "payment_processed",
  PAYMENT_REFUNDED = "payment_refunded",
  PRODUCT_CREATED = "product_created",
  PRODUCT_UPDATED = "product_updated",
  PRODUCT_DELETED = "product_deleted",
  USER_ROLE_CHANGED = "user_role_changed",
  USER_DEACTIVATED = "user_deactivated",
  USER_DELETED = "user_deleted",
}

export enum AuditResource {
  USER = "user",
  ORDER = "order",
  PAYMENT = "payment",
  PRODUCT = "product",
  CATEGORY = "category",
  REVIEW = "review",
}

@Entity("audit_logs")
@Index(["userId"])
@Index(["action"])
@Index(["resourceType"])
@Index(["resourceId"])
@Index(["createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", nullable: true })
  userId: string;

  @Column({ name: "user_email", nullable: true })
  userEmail: string;

  @Column({
    type: "enum",
    enum: AuditAction,
    name: "action",
  })
  action: AuditAction;

  @Column({
    type: "enum",
    enum: AuditResource,
    name: "resource_type",
  })
  resourceType: AuditResource;

  @Column({ name: "resource_id", nullable: true })
  resourceId: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true, name: "old_values" })
  oldValues: Record<string, any>;

  @Column({ type: "jsonb", nullable: true, name: "new_values" })
  newValues: Record<string, any>;

  @Column({ name: "ip_address", nullable: true })
  ipAddress: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent: string;

  @Column({ name: "trace_id", nullable: true })
  traceId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
