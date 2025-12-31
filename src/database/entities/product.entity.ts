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
import { Category } from "./category.entity";
import { User } from "./user.entity";
import { ProductVariant } from "./product-variant.entity";
import { ProductImage } from "./product-image.entity";
import { ProductTag } from "./product-tag.entity";
import { OrderItem } from "./order-item.entity";
import { Review } from "./review.entity";
import { Wishlist } from "./wishlist.entity";

export enum ProductStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

@Entity("products")
@Index(["sku"])
@Index(["status"])
@Index(["categoryId"])
@Index(["sellerId"])
@Index(["createdAt"])
@Index(["averageRating", "soldCount"])
export class Product {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    name: "sale_price",
  })
  salePrice: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: 10, name: "low_stock_threshold" })
  lowStockThreshold: number;

  @Column({
    type: "enum",
    enum: ProductStatus,
    default: ProductStatus.DRAFT,
  })
  status: ProductStatus;

  @Column({ type: "simple-array", nullable: true })
  images: string[];

  @Column({ type: "text", nullable: true, name: "short_description" })
  shortDescription: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  weight: number;

  @Column({ nullable: true })
  dimensions: string; // JSON: { length, width, height }

  @Column({ default: true })
  taxable: boolean;

  @Column({ name: "tax_class", default: "standard" })
  taxClass: string;

  @Column({ name: "meta_title", nullable: true })
  metaTitle: string;

  @Column({ name: "meta_description", type: "text", nullable: true })
  metaDescription: string;

  @Column({ name: "view_count", default: 0 })
  viewCount: number;

  @Column({ name: "sold_count", default: 0 })
  soldCount: number;

  @Column({ name: "average_rating", default: 0 })
  averageRating: number;

  @Column({ name: "review_count", default: 0 })
  reviewCount: number;

  @Column({ name: "category_id", nullable: true })
  categoryId: string;

  @Column({ name: "seller_id", nullable: true })
  sellerId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, (category) => category.products, {
    nullable: true,
  })
  @JoinColumn({ name: "category_id" })
  category: Category;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "seller_id" })
  seller: User;

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => ProductImage, (image) => image.product)
  imagesRelation: ProductImage[];

  @OneToMany(() => ProductTag, (productTag) => productTag.product)
  productTags: ProductTag[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
  wishlistItems: Wishlist[];
}
