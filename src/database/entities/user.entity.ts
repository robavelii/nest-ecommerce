import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from "typeorm";
import * as bcrypt from "bcrypt";
import { Exclude } from "class-transformer";
import { Order } from "./order.entity";
import { Review } from "./review.entity";
import { Address } from "./address.entity";
import { Wishlist } from "./wishlist.entity";
import { CartItem } from "./cart-item.entity";

export enum Role {
  CUSTOMER = "customer",
  SELLER = "seller",
  ADMIN = "admin",
}

export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
  GITHUB = "github",
}

@Entity("users")
@Index(["email"])
@Index(["authProvider", "providerId"])
@Index(["isActive"])
@Index(["createdAt"])
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column({ nullable: true })
  password: string;

  @Column({ name: "first_name" })
  firstName: string;

  @Column({ name: "last_name" })
  lastName: string;

  @Column({
    type: "enum",
    enum: Role,
    default: Role.CUSTOMER,
  })
  role: Role;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: true, name: "is_active" })
  isActive: boolean;

  @Column({ default: false, name: "is_email_verified" })
  isEmailVerified: boolean;

  @Column({
    type: "enum",
    enum: AuthProvider,
    default: AuthProvider.LOCAL,
    name: "auth_provider",
  })
  authProvider: AuthProvider;

  @Column({ nullable: true, name: "provider_id" })
  providerId: string;

  @Exclude()
  @Column({ nullable: true, name: "refresh_token" })
  refreshToken: string;

  @Column({ nullable: true, name: "reset_password_token" })
  resetPasswordToken: string;

  @Column({ nullable: true, name: "reset_password_expires" })
  resetPasswordExpires: Date;

  @Column({ nullable: true, name: "last_login_at" })
  lastLoginAt: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.user)
  wishlist: Wishlist[];

  @OneToMany(() => CartItem, (cartItem) => cartItem.user)
  cartItems: CartItem[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashSensitiveData() {
    if (this.password && !this.password.startsWith("$2b$")) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    if (this.refreshToken && !this.refreshToken.startsWith("$2b$")) {
      this.refreshToken = await bcrypt.hash(this.refreshToken, 12);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
