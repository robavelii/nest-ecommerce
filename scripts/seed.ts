/**
 * Database Seed Script
 * Populates the database with comprehensive test data
 * 
 * Usage: npx ts-node scripts/seed.ts
 * Or via package.json: yarn seed
 * 
 * Options:
 *   --clean    Clears existing data before seeding
 */

import { DataSource, In } from 'typeorm';
import { config } from 'dotenv';
import * as bcrypt from 'bcrypt';

config();

// Import all entities
import { User, Role, AuthProvider } from '../src/database/entities/user.entity';
import { Address } from '../src/database/entities/address.entity';
import { Category } from '../src/database/entities/category.entity';
import { Product, ProductStatus } from '../src/database/entities/product.entity';
import { Order, OrderStatus } from '../src/database/entities/order.entity';
import { OrderItem } from '../src/database/entities/order-item.entity';
import { Review } from '../src/database/entities/review.entity';
import { CartItem } from '../src/database/entities/cart-item.entity';
import { Wishlist } from '../src/database/entities/wishlist.entity';
import { ProductVariant } from '../src/database/entities/product-variant.entity';
import { ProductImage } from '../src/database/entities/product-image.entity';
import { ProductTag } from '../src/database/entities/product-tag.entity';
import { Payment } from '../src/database/entities/payment.entity';

// Check for --clean flag
const shouldClean = process.argv.includes('--clean');

// ============================================
// SEED DATA DEFINITIONS
// ============================================

const categories = [
  // Parent categories
  { slug: 'electronics', name: 'Electronics', description: 'Electronic devices and gadgets', sortOrder: 1 },
  { slug: 'clothing', name: 'Clothing', description: 'Fashion and apparel', sortOrder: 2 },
  { slug: 'home-garden', name: 'Home & Garden', description: 'Home decor and garden supplies', sortOrder: 3 },
  { slug: 'sports', name: 'Sports & Outdoors', description: 'Sports equipment and outdoor gear', sortOrder: 4 },
  { slug: 'books', name: 'Books', description: 'Books and literature', sortOrder: 5 },
  // Subcategories (will be linked after creation)
];

const subcategories = [
  { slug: 'smartphones', name: 'Smartphones', description: 'Mobile phones and accessories', parentSlug: 'electronics', sortOrder: 1 },
  { slug: 'laptops', name: 'Laptops', description: 'Laptops and notebooks', parentSlug: 'electronics', sortOrder: 2 },
  { slug: 'headphones', name: 'Headphones', description: 'Audio headphones and earbuds', parentSlug: 'electronics', sortOrder: 3 },
  { slug: 'cameras', name: 'Cameras', description: 'Digital cameras and accessories', parentSlug: 'electronics', sortOrder: 4 },
  { slug: 'mens-clothing', name: "Men's Clothing", description: 'Clothing for men', parentSlug: 'clothing', sortOrder: 1 },
  { slug: 'womens-clothing', name: "Women's Clothing", description: 'Clothing for women', parentSlug: 'clothing', sortOrder: 2 },
  { slug: 'shoes', name: 'Shoes', description: 'Footwear for all', parentSlug: 'clothing', sortOrder: 3 },
  { slug: 'furniture', name: 'Furniture', description: 'Home furniture', parentSlug: 'home-garden', sortOrder: 1 },
  { slug: 'kitchen', name: 'Kitchen', description: 'Kitchen appliances and tools', parentSlug: 'home-garden', sortOrder: 2 },
  { slug: 'fitness', name: 'Fitness Equipment', description: 'Exercise and fitness gear', parentSlug: 'sports', sortOrder: 1 },
  { slug: 'outdoor-gear', name: 'Outdoor Gear', description: 'Camping and hiking equipment', parentSlug: 'sports', sortOrder: 2 },
];

const users = [
  // Customers
  { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: Role.CUSTOMER, phone: '+1-555-100-0001' },
  { email: 'jane.smith@example.com', firstName: 'Jane', lastName: 'Smith', role: Role.CUSTOMER, phone: '+1-555-100-0002' },
  { email: 'bob.wilson@example.com', firstName: 'Bob', lastName: 'Wilson', role: Role.CUSTOMER, phone: '+1-555-100-0003' },
  { email: 'alice.johnson@example.com', firstName: 'Alice', lastName: 'Johnson', role: Role.CUSTOMER, phone: '+1-555-100-0004' },
  { email: 'charlie.brown@example.com', firstName: 'Charlie', lastName: 'Brown', role: Role.CUSTOMER, phone: '+1-555-100-0005' },
  { email: 'diana.ross@example.com', firstName: 'Diana', lastName: 'Ross', role: Role.CUSTOMER, phone: '+1-555-100-0006' },
  { email: 'edward.norton@example.com', firstName: 'Edward', lastName: 'Norton', role: Role.CUSTOMER, phone: '+1-555-100-0007' },
  { email: 'fiona.apple@example.com', firstName: 'Fiona', lastName: 'Apple', role: Role.CUSTOMER, phone: '+1-555-100-0008' },
  // Sellers
  { email: 'seller1@example.com', firstName: 'Tech', lastName: 'Store', role: Role.SELLER, phone: '+1-555-200-0001' },
  { email: 'seller2@example.com', firstName: 'Fashion', lastName: 'Hub', role: Role.SELLER, phone: '+1-555-200-0002' },
  { email: 'seller3@example.com', firstName: 'Home', lastName: 'Essentials', role: Role.SELLER, phone: '+1-555-200-0003' },
];

const products = [
  // Electronics - Smartphones
  {
    sku: 'PHONE-001',
    name: 'iPhone 15 Pro Max',
    description: 'The latest iPhone with A17 Pro chip, titanium design, and advanced camera system. Features a 6.7-inch Super Retina XDR display with ProMotion technology.',
    shortDescription: 'Premium smartphone with cutting-edge technology',
    price: 1199.99,
    salePrice: 1099.99,
    stock: 50,
    categorySlug: 'smartphones',
    status: ProductStatus.ACTIVE,
    weight: 0.22,
    taxable: true,
  },
  {
    sku: 'PHONE-002',
    name: 'Samsung Galaxy S24 Ultra',
    description: 'Samsung flagship with Galaxy AI, S Pen, and 200MP camera. Features a 6.8-inch Dynamic AMOLED display with Snapdragon 8 Gen 3 processor.',
    shortDescription: 'Android flagship with AI capabilities',
    price: 1299.99,
    stock: 45,
    categorySlug: 'smartphones',
    status: ProductStatus.ACTIVE,
    weight: 0.23,
  },
  {
    sku: 'PHONE-003',
    name: 'Google Pixel 8 Pro',
    description: 'Pure Android experience with the best computational photography. Features Tensor G3 chip and 7 years of software updates.',
    shortDescription: 'Best camera phone with AI features',
    price: 999.99,
    salePrice: 899.99,
    stock: 30,
    categorySlug: 'smartphones',
    status: ProductStatus.ACTIVE,
    weight: 0.21,
  },
  // Electronics - Laptops
  {
    sku: 'LAPTOP-001',
    name: 'MacBook Pro 16" M3 Max',
    description: 'Professional laptop with M3 Max chip, up to 128GB unified memory, and stunning Liquid Retina XDR display. Perfect for developers and creatives.',
    shortDescription: 'Most powerful MacBook ever',
    price: 3499.99,
    stock: 20,
    categorySlug: 'laptops',
    status: ProductStatus.ACTIVE,
    weight: 2.14,
  },
  {
    sku: 'LAPTOP-002',
    name: 'Dell XPS 15',
    description: 'Premium Windows laptop with 13th Gen Intel Core i9, NVIDIA GeForce RTX 4070, and InfinityEdge OLED display.',
    shortDescription: 'Premium Windows laptop for professionals',
    price: 2199.99,
    salePrice: 1999.99,
    stock: 25,
    categorySlug: 'laptops',
    status: ProductStatus.ACTIVE,
    weight: 1.86,
  },
  {
    sku: 'LAPTOP-003',
    name: 'ThinkPad X1 Carbon Gen 11',
    description: 'Legendary business laptop with military-grade durability, excellent keyboard, and all-day battery life.',
    shortDescription: 'Ultimate business laptop',
    price: 1899.99,
    stock: 15,
    categorySlug: 'laptops',
    status: ProductStatus.ACTIVE,
    weight: 1.12,
  },
  // Electronics - Headphones
  {
    sku: 'AUDIO-001',
    name: 'Sony WH-1000XM5',
    description: 'Industry-leading noise cancellation with exceptional sound quality. 30-hour battery life and ultra-comfortable design.',
    shortDescription: 'Best noise-cancelling headphones',
    price: 399.99,
    salePrice: 349.99,
    stock: 100,
    categorySlug: 'headphones',
    status: ProductStatus.ACTIVE,
    weight: 0.25,
  },
  {
    sku: 'AUDIO-002',
    name: 'AirPods Pro 2',
    description: 'Active Noise Cancellation, Adaptive Audio, and Personalized Spatial Audio. USB-C charging case included.',
    shortDescription: 'Apple premium earbuds',
    price: 249.99,
    stock: 150,
    categorySlug: 'headphones',
    status: ProductStatus.ACTIVE,
    weight: 0.05,
  },
  // Clothing - Men's
  {
    sku: 'CLOTH-M-001',
    name: 'Premium Cotton T-Shirt',
    description: '100% organic cotton t-shirt with a comfortable fit. Pre-shrunk and available in multiple colors.',
    shortDescription: 'Comfortable everyday t-shirt',
    price: 29.99,
    salePrice: 24.99,
    stock: 200,
    categorySlug: 'mens-clothing',
    status: ProductStatus.ACTIVE,
    weight: 0.2,
  },
  {
    sku: 'CLOTH-M-002',
    name: 'Slim Fit Chinos',
    description: 'Modern slim fit chinos made from stretch cotton. Perfect for both casual and business casual occasions.',
    shortDescription: 'Versatile slim fit pants',
    price: 79.99,
    stock: 80,
    categorySlug: 'mens-clothing',
    status: ProductStatus.ACTIVE,
    weight: 0.4,
  },
  {
    sku: 'CLOTH-M-003',
    name: 'Leather Jacket',
    description: 'Classic motorcycle-style leather jacket made from genuine lambskin leather. Quilted lining for extra warmth.',
    shortDescription: 'Classic leather jacket',
    price: 299.99,
    stock: 30,
    categorySlug: 'mens-clothing',
    status: ProductStatus.ACTIVE,
    weight: 1.5,
  },
  // Clothing - Women's
  {
    sku: 'CLOTH-W-001',
    name: 'Floral Summer Dress',
    description: 'Lightweight floral dress perfect for summer. Features a flattering A-line silhouette and adjustable straps.',
    shortDescription: 'Beautiful summer dress',
    price: 89.99,
    salePrice: 69.99,
    stock: 60,
    categorySlug: 'womens-clothing',
    status: ProductStatus.ACTIVE,
    weight: 0.3,
  },
  {
    sku: 'CLOTH-W-002',
    name: 'High-Waist Yoga Pants',
    description: 'Buttery soft yoga pants with high waist design. Four-way stretch fabric with moisture-wicking technology.',
    shortDescription: 'Comfortable yoga pants',
    price: 59.99,
    stock: 120,
    categorySlug: 'womens-clothing',
    status: ProductStatus.ACTIVE,
    weight: 0.25,
  },
  // Shoes
  {
    sku: 'SHOE-001',
    name: 'Nike Air Max 90',
    description: 'Iconic Nike Air Max with visible Air cushioning. Classic design meets modern comfort.',
    shortDescription: 'Classic sneakers',
    price: 130.00,
    stock: 75,
    categorySlug: 'shoes',
    status: ProductStatus.ACTIVE,
    weight: 0.9,
  },
  {
    sku: 'SHOE-002',
    name: 'Adidas Ultraboost 23',
    description: 'Premium running shoes with Boost midsole technology. Continental rubber outsole for superior grip.',
    shortDescription: 'Premium running shoes',
    price: 190.00,
    salePrice: 159.99,
    stock: 50,
    categorySlug: 'shoes',
    status: ProductStatus.ACTIVE,
    weight: 0.85,
  },
  // Home & Garden - Furniture
  {
    sku: 'FURN-001',
    name: 'Modern Sectional Sofa',
    description: 'L-shaped sectional sofa with chaise lounge. Premium fabric upholstery with high-density foam cushions.',
    shortDescription: 'Comfortable L-shaped sofa',
    price: 1499.99,
    salePrice: 1299.99,
    stock: 10,
    categorySlug: 'furniture',
    status: ProductStatus.ACTIVE,
    weight: 85,
  },
  {
    sku: 'FURN-002',
    name: 'Ergonomic Office Chair',
    description: 'Mesh back office chair with lumbar support, adjustable armrests, and headrest. Perfect for long work sessions.',
    shortDescription: 'Comfortable office chair',
    price: 349.99,
    stock: 40,
    categorySlug: 'furniture',
    status: ProductStatus.ACTIVE,
    weight: 15,
  },
  // Sports & Fitness
  {
    sku: 'FIT-001',
    name: 'Adjustable Dumbbell Set',
    description: 'Space-saving adjustable dumbbells from 5 to 52.5 lbs. Quick weight change mechanism for efficient workouts.',
    shortDescription: 'Adjustable weights 5-52.5 lbs',
    price: 449.99,
    stock: 25,
    categorySlug: 'fitness',
    status: ProductStatus.ACTIVE,
    weight: 24,
  },
  {
    sku: 'FIT-002',
    name: 'Premium Yoga Mat',
    description: 'Extra thick 6mm yoga mat with alignment lines. Non-slip surface and eco-friendly materials.',
    shortDescription: 'Non-slip yoga mat',
    price: 79.99,
    salePrice: 59.99,
    stock: 100,
    categorySlug: 'fitness',
    status: ProductStatus.ACTIVE,
    weight: 1.5,
  },
  // Books
  {
    sku: 'BOOK-001',
    name: 'The Art of Programming',
    description: 'Comprehensive guide to software development best practices. Covers algorithms, design patterns, and clean code principles.',
    shortDescription: 'Programming best practices guide',
    price: 49.99,
    stock: 200,
    categorySlug: 'books',
    status: ProductStatus.ACTIVE,
    weight: 0.8,
  },
  // Draft product (for testing)
  {
    sku: 'DRAFT-001',
    name: 'Upcoming Product',
    description: 'This is a draft product that will be released soon.',
    shortDescription: 'Coming soon',
    price: 99.99,
    stock: 0,
    categorySlug: 'electronics',
    status: ProductStatus.DRAFT,
    weight: 0.5,
  },
  // Archived product
  {
    sku: 'ARCH-001',
    name: 'Discontinued Item',
    description: 'This product has been discontinued.',
    shortDescription: 'No longer available',
    price: 149.99,
    stock: 0,
    categorySlug: 'electronics',
    status: ProductStatus.ARCHIVED,
    weight: 0.3,
  },
];

const reviewData = [
  { rating: 5, title: 'Excellent product!', comment: 'This exceeded my expectations. Highly recommend to everyone!' },
  { rating: 5, title: 'Perfect purchase', comment: 'Exactly what I was looking for. Fast shipping and great quality.' },
  { rating: 4, title: 'Very good', comment: 'Great product overall. Minor issues but nothing major.' },
  { rating: 4, title: 'Happy customer', comment: 'Good value for money. Would buy again.' },
  { rating: 3, title: 'Average', comment: 'Does the job but nothing special. Expected a bit more for the price.' },
  { rating: 5, title: 'Amazing quality!', comment: 'The build quality is outstanding. Very impressed with this purchase.' },
  { rating: 4, title: 'Solid choice', comment: 'Reliable product that works as advertised.' },
  { rating: 5, title: 'Best purchase ever', comment: 'I can\'t believe how good this is. Life-changing!' },
];

const cities = [
  { city: 'New York', state: 'NY', zipCode: '10001' },
  { city: 'Los Angeles', state: 'CA', zipCode: '90001' },
  { city: 'Chicago', state: 'IL', zipCode: '60601' },
  { city: 'Houston', state: 'TX', zipCode: '77001' },
  { city: 'Phoenix', state: 'AZ', zipCode: '85001' },
  { city: 'Seattle', state: 'WA', zipCode: '98101' },
  { city: 'Miami', state: 'FL', zipCode: '33101' },
  { city: 'Denver', state: 'CO', zipCode: '80201' },
];

// ============================================
// SEEDING FUNCTIONS
// ============================================

async function seed() {
  console.log('🌱 Starting Database Seeder...\n');
  
  if (shouldClean) {
    console.log('⚠️  Clean mode enabled - existing data will be removed\n');
  }

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

    const userRepo = dataSource.getRepository(User);
    const addressRepo = dataSource.getRepository(Address);
    const categoryRepo = dataSource.getRepository(Category);
    const productRepo = dataSource.getRepository(Product);
    const orderRepo = dataSource.getRepository(Order);
    const orderItemRepo = dataSource.getRepository(OrderItem);
    const reviewRepo = dataSource.getRepository(Review);
    const cartItemRepo = dataSource.getRepository(CartItem);
    const wishlistRepo = dataSource.getRepository(Wishlist);

    // Clean existing data if flag is set
    if (shouldClean) {
      console.log('🧹 Cleaning existing data...');
      await wishlistRepo.createQueryBuilder().delete().execute();
      await cartItemRepo.createQueryBuilder().delete().execute();
      await reviewRepo.createQueryBuilder().delete().execute();
      await orderItemRepo.createQueryBuilder().delete().execute();
      await orderRepo.createQueryBuilder().delete().execute();
      await productRepo.createQueryBuilder().delete().execute();
      await categoryRepo.createQueryBuilder().delete().execute();
      await addressRepo.createQueryBuilder().delete().execute();
      await userRepo.createQueryBuilder().delete().execute();
      console.log('✅ Existing data cleaned\n');
    }

    // ========================================
    // 1. Seed Categories
    // ========================================
    console.log('📁 Seeding categories...');
    const categoryMap = new Map<string, Category>();
    
    for (const cat of categories) {
      const existing = await categoryRepo.findOne({ where: { slug: cat.slug } });
      if (!existing) {
        const category = categoryRepo.create({
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          sortOrder: cat.sortOrder,
          active: true,
        });
        const saved = await categoryRepo.save(category);
        categoryMap.set(cat.slug, saved);
        console.log(`   ✅ Created category: ${cat.name}`);
      } else {
        categoryMap.set(cat.slug, existing);
        console.log(`   ⏭️  Category exists: ${cat.name}`);
      }
    }

    // Seed subcategories
    for (const subcat of subcategories) {
      const existing = await categoryRepo.findOne({ where: { slug: subcat.slug } });
      if (!existing) {
        const parent = categoryMap.get(subcat.parentSlug);
        const category = categoryRepo.create({
          slug: subcat.slug,
          name: subcat.name,
          description: subcat.description,
          sortOrder: subcat.sortOrder,
          parentId: parent?.id,
          active: true,
        });
        const saved = await categoryRepo.save(category);
        categoryMap.set(subcat.slug, saved);
        console.log(`   ✅ Created subcategory: ${subcat.name}`);
      } else {
        categoryMap.set(subcat.slug, existing);
        console.log(`   ⏭️  Subcategory exists: ${subcat.name}`);
      }
    }
    console.log('');

    // ========================================
    // 2. Seed Users
    // ========================================
    console.log('👥 Seeding users...');
    const userMap = new Map<string, User>();
    const hashedPassword = await bcrypt.hash('Password123!', 12);
    
    for (const userData of users) {
      const existing = await userRepo.findOne({ where: { email: userData.email } });
      if (!existing) {
        const user = userRepo.create({
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          phone: userData.phone,
          authProvider: AuthProvider.LOCAL,
          isActive: true,
          isEmailVerified: true,
        });
        const saved = await userRepo.save(user);
        userMap.set(userData.email, saved);
        console.log(`   ✅ Created user: ${userData.email} (${userData.role})`);
      } else {
        userMap.set(userData.email, existing);
        console.log(`   ⏭️  User exists: ${userData.email}`);
      }
    }
    console.log('');

    // ========================================
    // 3. Seed Addresses for Users
    // ========================================
    console.log('📍 Seeding addresses...');
    const customers = Array.from(userMap.values()).filter(u => u.role === Role.CUSTOMER);
    
    for (let i = 0; i < customers.length; i++) {
      const user = customers[i];
      const existingAddress = await addressRepo.findOne({ where: { userId: user.id } });
      if (!existingAddress) {
        const cityInfo = cities[i % cities.length];
        const address = addressRepo.create({
          userId: user.id,
          label: 'home',
          firstName: user.firstName,
          lastName: user.lastName,
          company: '',
          street: `${100 + i} Main Street, Apt ${i + 1}`,
          city: cityInfo.city,
          state: cityInfo.state,
          zipCode: cityInfo.zipCode,
          country: 'USA',
          phone: user.phone || '+1-555-000-0000',
          isDefault: true,
        });
        await addressRepo.save(address);
        console.log(`   ✅ Created address for: ${user.email}`);
      } else {
        console.log(`   ⏭️  Address exists for: ${user.email}`);
      }
    }
    console.log('');

    // ========================================
    // 4. Seed Products
    // ========================================
    console.log('📦 Seeding products...');
    const sellers = Array.from(userMap.values()).filter(u => u.role === Role.SELLER);
    const productMap = new Map<string, Product>();
    
    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      const existing = await productRepo.findOne({ where: { sku: productData.sku } });
      if (!existing) {
        const category = categoryMap.get(productData.categorySlug);
        const seller = sellers[i % sellers.length];
        
        const product = productRepo.create({
          sku: productData.sku,
          name: productData.name,
          description: productData.description,
          shortDescription: productData.shortDescription,
          price: productData.price,
          salePrice: productData.salePrice,
          stock: productData.stock,
          status: productData.status,
          weight: productData.weight || 0,
          taxable: productData.taxable !== false,
          categoryId: category?.id,
          sellerId: seller?.id,
          lowStockThreshold: 10,
          viewCount: Math.floor(Math.random() * 1000),
          soldCount: Math.floor(Math.random() * 100),
        });
        const saved = await productRepo.save(product);
        productMap.set(productData.sku, saved);
        console.log(`   ✅ Created product: ${productData.name}`);
      } else {
        productMap.set(productData.sku, existing);
        console.log(`   ⏭️  Product exists: ${productData.name}`);
      }
    }
    console.log('');

    // ========================================
    // 5. Seed Reviews
    // ========================================
    console.log('⭐ Seeding reviews...');
    const activeProducts = Array.from(productMap.values()).filter(p => p.status === ProductStatus.ACTIVE);
    
    for (const product of activeProducts.slice(0, 10)) { // Reviews for first 10 active products
      for (let i = 0; i < Math.min(3, customers.length); i++) {
        const user = customers[i];
        const reviewInfo = reviewData[Math.floor(Math.random() * reviewData.length)];
        
        const existingReview = await reviewRepo.findOne({
          where: { userId: user.id, productId: product.id },
        });
        
        if (!existingReview) {
          const review = reviewRepo.create({
            userId: user.id,
            productId: product.id,
            rating: reviewInfo.rating,
            title: reviewInfo.title,
            comment: reviewInfo.comment,
            isVerifiedPurchase: Math.random() > 0.3,
            isApproved: true,
            helpful: Math.floor(Math.random() * 20),
          });
          await reviewRepo.save(review);
        }
      }
    }
    console.log(`   ✅ Seeded reviews for products\n`);

    // Update product ratings
    for (const product of activeProducts) {
      const reviews = await reviewRepo.find({ where: { productId: product.id } });
      if (reviews.length > 0) {
        const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
        await productRepo.update(product.id, {
          averageRating: Math.round(avgRating), // Round to integer
          reviewCount: reviews.length,
        });
      }
    }

    // ========================================
    // 6. Seed Orders
    // ========================================
    console.log('🛒 Seeding orders...');
    let orderCount = 0;
    
    for (const customer of customers.slice(0, 5)) { // Orders for first 5 customers
      const address = await addressRepo.findOne({ where: { userId: customer.id } });
      if (!address) continue;
      
      // Check if user already has orders
      const existingOrders = await orderRepo.count({ where: { userId: customer.id } });
      if (existingOrders > 0) {
        console.log(`   ⏭️  Orders exist for: ${customer.email}`);
        continue;
      }

      // Create 2-3 orders per customer
      const numOrders = Math.floor(Math.random() * 2) + 2;
      
      for (let o = 0; o < numOrders; o++) {
        const orderProducts = activeProducts
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(Math.random() * 3) + 1);
        
        let subtotal = 0;
        const items: Partial<OrderItem>[] = [];
        
        for (const product of orderProducts) {
          const quantity = Math.floor(Math.random() * 3) + 1;
          const price = product.salePrice || product.price;
          subtotal += Number(price) * quantity;
          
          items.push({
            productId: product.id,
            name: product.name,
            sku: product.sku,
            quantity,
            unitPrice: Number(price),
            total: Number(price) * quantity,
          });
        }
        
        const tax = subtotal * 0.08;
        const shippingCost = subtotal > 100 ? 0 : 9.99;
        const total = subtotal + tax + shippingCost;
        
        const statuses = [OrderStatus.DELIVERED, OrderStatus.SHIPPED, OrderStatus.PROCESSING, OrderStatus.CONFIRMED];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const newOrder = new Order();
        newOrder.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        newOrder.userId = customer.id;
        newOrder.status = status;
        newOrder.subtotal = subtotal;
        newOrder.tax = tax;
        newOrder.shippingCost = shippingCost;
        newOrder.total = total;
        newOrder.shippingAddress = {
          firstName: address.firstName,
          lastName: address.lastName,
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
          phone: address.phone,
        };
        newOrder.billingAddress = {
          firstName: address.firstName,
          lastName: address.lastName,
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country,
          phone: address.phone,
        };
        if (status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED) {
          newOrder.shippedAt = new Date();
        }
        if (status === OrderStatus.DELIVERED) {
          newOrder.deliveredAt = new Date();
        }
        
        const savedOrder = await orderRepo.save(newOrder);
        
        // Save order items
        for (const item of items) {
          const newOrderItem = new OrderItem();
          newOrderItem.orderId = savedOrder.id;
          newOrderItem.productId = item.productId!;
          newOrderItem.name = item.name!;
          newOrderItem.sku = item.sku!;
          newOrderItem.unitPrice = item.unitPrice!;
          newOrderItem.quantity = item.quantity!;
          newOrderItem.total = item.total!;
          await orderItemRepo.save(newOrderItem);
        }
        
        orderCount++;
      }
      console.log(`   ✅ Created ${numOrders} orders for: ${customer.email}`);
    }
    console.log('');

    // ========================================
    // 7. Seed Cart Items
    // ========================================
    console.log('🛍️ Seeding cart items...');
    for (const customer of customers.slice(5, 8)) { // Cart items for customers 6-8
      const existingCart = await cartItemRepo.count({ where: { userId: customer.id } });
      if (existingCart > 0) {
        console.log(`   ⏭️  Cart exists for: ${customer.email}`);
        continue;
      }

      const cartProducts = activeProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 4) + 1);
      
      for (const product of cartProducts) {
        const cartItem = cartItemRepo.create({
          userId: customer.id,
          productId: product.id,
          quantity: Math.floor(Math.random() * 3) + 1,
        });
        await cartItemRepo.save(cartItem);
      }
      console.log(`   ✅ Added cart items for: ${customer.email}`);
    }
    console.log('');

    // ========================================
    // 8. Seed Wishlists
    // ========================================
    console.log('❤️ Seeding wishlists...');
    for (const customer of customers.slice(0, 6)) {
      const existingWishlist = await wishlistRepo.count({ where: { userId: customer.id } });
      if (existingWishlist > 0) {
        console.log(`   ⏭️  Wishlist exists for: ${customer.email}`);
        continue;
      }

      const wishlistProducts = activeProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 5) + 2);
      
      for (const product of wishlistProducts) {
        const wishlistItem = wishlistRepo.create({
          userId: customer.id,
          productId: product.id,
        });
        await wishlistRepo.save(wishlistItem);
      }
      console.log(`   ✅ Added wishlist items for: ${customer.email}`);
    }
    console.log('');

    // ========================================
    // Summary
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Seeding Summary:');
    console.log(`   Categories: ${await categoryRepo.count()}`);
    console.log(`   Users: ${await userRepo.count()}`);
    console.log(`   Products: ${await productRepo.count()}`);
    console.log(`   Orders: ${await orderRepo.count()}`);
    console.log(`   Reviews: ${await reviewRepo.count()}`);
    console.log(`   Cart Items: ${await cartItemRepo.count()}`);
    console.log(`   Wishlists: ${await wishlistRepo.count()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Database seeding completed successfully!\n');
    
    console.log('📋 Test User Credentials (all passwords: Password123!):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Customers:');
    for (const user of users.filter(u => u.role === Role.CUSTOMER).slice(0, 3)) {
      console.log(`   ${user.email}`);
    }
    console.log('\nSellers:');
    for (const user of users.filter(u => u.role === Role.SELLER)) {
      console.log(`   ${user.email}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('✅ Database connection closed');
  }
}

// Run the seeder
seed();

