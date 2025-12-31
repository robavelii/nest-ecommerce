import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Order } from "./order.entity";
import { Product } from "./product.entity";
import { ProductVariant } from "./product-variant.entity";

@Entity("order_items")
@Index(["orderId"])
@Index(["productId"])
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "order_id" })
  orderId: string;

  @Column({ name: "product_id" })
  productId: string;

  @Column({ name: "variant_id", nullable: true })
  variantId: string;

  @Column()
  name: string;

  @Column()
  sku: string;

  @Column({ type: "decimal", precision: 10, scale: 2, name: "unit_price" })
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  total: number;

  @Column({ nullable: true, name: "product_snapshot" })
  productSnapshot: string; // JSON with product details at time of order

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: Order;

  @ManyToOne(() => Product, { onDelete: "SET NULL" })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "variant_id" })
  variant: ProductVariant;
}
