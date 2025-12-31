import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { User } from "./entities/user.entity";
import { Address } from "./entities/address.entity";
import { Category } from "./entities/category.entity";
import { Product } from "./entities/product.entity";
import { ProductVariant } from "./entities/product-variant.entity";
import { ProductImage } from "./entities/product-image.entity";
import { ProductTag } from "./entities/product-tag.entity";
import { CartItem } from "./entities/cart-item.entity";
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Payment } from "./entities/payment.entity";
import { Review } from "./entities/review.entity";
import { Wishlist } from "./entities/wishlist.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { Coupon } from "./entities/coupon.entity";

config();

const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "ecommerce",
  entities: [
    User,
    Address,
    Category,
    Product,
    ProductVariant,
    ProductImage,
    ProductTag,
    CartItem,
    Order,
    OrderItem,
    Payment,
    Review,
    Wishlist,
    AuditLog,
    Coupon,
  ],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: process.env.DB_SYNCHRONIZE === "true",
  logging: process.env.DB_LOGGING === "true",
};

const dataSource = new DataSource(dataSourceOptions);

export { dataSource, dataSourceOptions };
