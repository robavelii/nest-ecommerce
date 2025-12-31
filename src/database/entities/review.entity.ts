import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Product } from "./product.entity";

@Entity("reviews")
@Unique(["userId", "productId"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "product_id" })
  productId: string;

  @Column({ name: "order_id", nullable: true })
  orderId: string;

  @Column({ default: 5 })
  rating: number;

  @Column({ type: "text", nullable: true })
  title: string;

  @Column({ type: "text" })
  comment: string;

  @Column({ default: false, name: "is_verified_purchase" })
  isVerifiedPurchase: boolean;

  @Column({ default: false, name: "is_approved" })
  isApproved: boolean;

  @Column({ default: 0 })
  helpful: number;

  @Column({ nullable: true, name: "helpful_votes", type: "simple-array" })
  helpfulVotes: string[]; // Array of user IDs who found it helpful

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.reviews, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ManyToOne(() => Product, (product) => product.reviews, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "product_id" })
  product: Product;
}
