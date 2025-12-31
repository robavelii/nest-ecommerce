/**
 * Admin Seeder Script
 * Creates admin users for the e-commerce platform
 * 
 * Usage: npx ts-node scripts/seed-admin.ts
 * Or via package.json: yarn seed:admin
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';

config();

// Import entities
import { User, Role, AuthProvider } from '../src/database/entities/user.entity';
import { Address } from '../src/database/entities/address.entity';
import { Category } from '../src/database/entities/category.entity';
import { Product } from '../src/database/entities/product.entity';
import { ProductVariant } from '../src/database/entities/product-variant.entity';
import { ProductImage } from '../src/database/entities/product-image.entity';
import { ProductTag } from '../src/database/entities/product-tag.entity';
import { Order } from '../src/database/entities/order.entity';
import { OrderItem } from '../src/database/entities/order-item.entity';
import { Payment } from '../src/database/entities/payment.entity';
import { Review } from '../src/database/entities/review.entity';
import { CartItem } from '../src/database/entities/cart-item.entity';
import { Wishlist } from '../src/database/entities/wishlist.entity';

interface AdminUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

const adminUsers: AdminUser[] = [
  {
    email: 'admin@ecommerce.com',
    password: 'Admin@123456',
    firstName: 'Super',
    lastName: 'Admin',
    phone: '+1-555-000-0001',
  },
  {
    email: 'manager@ecommerce.com',
    password: 'Manager@123456',
    firstName: 'Store',
    lastName: 'Manager',
    phone: '+1-555-000-0002',
  },
];

async function seedAdmins() {
  console.log('🚀 Starting Admin Seeder...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'ecommerce',
    entities: [User, Address, Category, Product, ProductVariant, ProductImage, ProductTag, Order, OrderItem, Payment, Review, CartItem, Wishlist],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const userRepository = dataSource.getRepository(User);
    const addressRepository = dataSource.getRepository(Address);

    let created = 0;
    let skipped = 0;

    for (const admin of adminUsers) {
      // Check if admin already exists
      const existingUser = await userRepository.findOne({
        where: { email: admin.email },
      });

      if (existingUser) {
        console.log(`⏭️  Admin "${admin.email}" already exists, skipping...`);
        skipped++;
        continue;
      }

      // Create admin user
      const hashedPassword = await bcrypt.hash(admin.password, 12);

      const newAdmin = userRepository.create({
        email: admin.email,
        password: hashedPassword,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        role: Role.ADMIN,
        authProvider: AuthProvider.LOCAL,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: new Date(),
      });

      const savedAdmin = await userRepository.save(newAdmin);

      // Create a default address for admin
      const adminAddress = addressRepository.create({
        userId: savedAdmin.id,
        label: 'office',
        firstName: admin.firstName,
        lastName: admin.lastName,
        company: 'E-Commerce HQ',
        street: '123 Admin Street',
        city: 'Tech City',
        state: 'CA',
        zipCode: '94105',
        country: 'USA',
        phone: admin.phone || '+1-555-000-0000',
        isDefault: true,
      });

      await addressRepository.save(adminAddress);

      console.log(`✅ Created admin: ${admin.email}`);
      console.log(`   Password: ${admin.password}`);
      console.log(`   Role: ${Role.ADMIN}\n`);
      created++;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Admin seeding completed successfully!\n');

    // Print login credentials
    console.log('📋 Admin Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    for (const admin of adminUsers) {
      console.log(`   Email: ${admin.email}`);
      console.log(`   Password: ${admin.password}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error seeding admins:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('✅ Database connection closed');
  }
}

// Run the seeder
seedAdmins();

