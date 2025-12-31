# Advanced E-Commerce Backend API

## Project Overview

This is a **production-ready, full-featured e-commerce RESTful API** built with **NestJS** and **TypeORM**, designed to mirror the architectural patterns and industry standards used by large tech companies like Shopify, Amazon, and Alibaba.

## Key Features

### Advanced Authentication & Authorization
- **Dual Authentication System:**
  - Traditional email/password with JWT and refresh tokens
  - Social OAuth2 integration (Google & GitHub) using Passport.js
- **Role-Based Access Control (RBAC):** Customer, Seller, Admin roles
- **Security Features:** Password hashing with bcrypt, rate limiting, input validation

### Complete E-Commerce Functionality
- **Product Management:** Full CRUD with categories, inventory tracking, reviews
- **Shopping Cart:** Session-based cart management with automatic cleanup
- **Order Processing:** Complete order lifecycle with status transitions
- **Payment Integration:** Stripe integration with webhook handling
- **Product Reviews:** User reviews with rating aggregation and validation
- **File Uploads:** Product images and user avatars with Multer

### Production-Ready Architecture
- **Modular Monolith:** Well-organized, maintainable codebase
- **Clean Architecture:** Separation of concerns with DTOs, services, controllers
- **Database Design:** Optimized PostgreSQL schema with proper relationships
- **Error Handling:** Global exception filters with structured logging
- **API Documentation:** Complete Swagger/OpenAPI documentation

## Project Structure

```
src/
├── admin/                    # Admin management endpoints
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   ├── admin.module.ts
│   └── dto/
├── auth/                     # Authentication & authorization
│   ├── controllers/
│   ├── services/
│   ├── strategies/           # Passport strategies
│   ├── guards/              # JWT, Local, OAuth guards
│   └── dto/
├── cart/                     # Shopping cart management
├── categories/               # Product categories
├── common/                   # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── logger/
├── config/                   # Configuration schemas
├── database/                 # Database configuration & entities
│   └── entities/            # TypeORM entities
├── orders/                   # Order management
├── payments/                 # Payment processing (Stripe)
├── products/                 # Product catalog
├── reviews/                  # Product reviews
├── uploads/                  # File upload handling
├── users/                    # User management
├── app.module.ts
└── main.ts
```

## 🗄️ Database Schema

### Core Entities
1. **User** - Authentication, roles, profile information
2. **Product** - Product catalog with inventory and reviews
3. **Category** - Product categorization
4. **Cart & CartItem** - Shopping cart functionality
5. **Order & OrderItem** - Order processing and tracking
6. **Payment** - Payment records and status
7. **Review** - Product reviews and ratings
8. **RefreshToken** - JWT refresh token management

### Key Relationships
- User → Cart (One-to-Many)
- User → Orders (One-to-Many)
- Product → Reviews (One-to-Many)
- Order → OrderItems → Products (Many-to-Many through OrderItem)
- Category → Products (One-to-Many)

## Getting Started

### Prerequisites
- **Node.js** 18+ and npm
- **PostgreSQL** 13+
- **Redis** (for caching)
- **Docker & Docker Compose** (recommended)

### Environment Variables
Create a `.env` file in the root directory:

```bash
# Application
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/ecommerce_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ecommerce_db

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-token-secret-key-here
REFRESH_TOKEN_EXPIRES_IN=7d

# OAuth2 Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_WEBHOOK_ENDPOINT_SECRET=whsec_your_endpoint_secret

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
MAX_FILES_PER_UPLOAD=10

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=10

# Email (optional - for notifications)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

### Installation & Setup

1. **Clone and install dependencies:**
```bash
# Install dependencies
npm install
```

2. **Database Setup:**
```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Run database migrations
npm run migration:run

# Seed the database (optional)
npm run seed
```

3. **Start the application:**
```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod
```

## API Documentation

### Authentication Endpoints

#### Traditional Auth
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh JWT token
- `POST /auth/logout` - User logout

#### OAuth2 Auth
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - GitHub OAuth callback

### Core API Endpoints

#### Products
- `GET /products` - List products with filtering/pagination
- `GET /products/:id` - Get product details
- `POST /products` - Create product (Seller/Admin)
- `PUT /products/:id` - Update product (Seller/Admin)
- `DELETE /products/:id` - Delete product (Seller/Admin)

#### Shopping Cart
- `GET /cart` - Get user's cart
- `POST /cart/items` - Add item to cart
- `PUT /cart/items/:id` - Update cart item
- `DELETE /cart/items/:id` - Remove cart item
- `DELETE /cart/clear` - Clear entire cart

#### Orders
- `GET /orders` - Get user's orders
- `GET /orders/:id` - Get order details
- `POST /orders` - Create order from cart
- `POST /orders/:id/cancel` - Cancel order

#### Reviews
- `GET /reviews` - Get product reviews
- `POST /reviews` - Create product review
- `PUT /reviews/:id` - Update review
- `DELETE /reviews/:id` - Delete review
- `GET /reviews/product/:id/stats` - Get review statistics

#### File Uploads
- `POST /uploads/product-image` - Upload product image
- `POST /uploads/product-images` - Upload multiple product images
- `POST /uploads/avatar` - Upload user avatar

#### Admin Panel
- `GET /admin/dashboard` - Admin dashboard statistics
- `GET /admin/users` - Manage users
- `GET /admin/orders` - Manage all orders
- `GET /admin/analytics/orders` - Order analytics

### Complete API Documentation
After starting the server, visit: `http://localhost:3000/api/docs`

## 🔧 Advanced Configuration

### Database Migrations
```bash
# Generate new migration
npm run migration:generate --name=MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

### Testing
```bash
# Unit tests
npm run test

# Integration tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Production Deployment
```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

## Architecture Patterns

### 1. Modular Monolith
Each feature is organized into self-contained modules with clear boundaries, making the codebase maintainable and scalable.

### 2. Clean Architecture
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic implementation
- **DTOs**: Data validation and transformation
- **Entities**: Database models with TypeORM
- **Guards**: Authentication and authorization logic

### 3. Dependency Injection
Leverages NestJS's powerful DI container for loose coupling and testability.

### 4. Database Patterns
- **Repository Pattern** with TypeORM
- **Database Transactions** for complex operations
- **Optimistic Locking** for inventory management
- **Proper Indexing** for performance

### 5. Security Best Practices
- **Input Validation** with class-validator
- **Rate Limiting** with throttler
- **CORS** configuration
- **Helmet** for security headers
- **Password Hashing** with bcrypt

### Production Readiness
1. **Configuration Management**: Environment variables with validation
2. **Logging**: Structured logging with Winston
3. **Monitoring**: Health checks and metrics
4. **Security**: Input validation, rate limiting, secure headers
5. **Performance**: Database optimization, caching, pagination
6. **Testing**: Unit, integration, and e2e testing strategies

### Industry Standards
1. **Code Organization**: Modular structure following separation of concerns
2. **TypeScript**: Strong typing for maintainability and developer experience
3. **Docker**: Containerization for consistent development/deployment
4. **Git Workflow**: Feature branches, conventional commits
5. **Documentation**: Comprehensive API documentation and code comments

## Next Steps

1. **Microservices Migration**: Split modules into separate services
2. **Message Queues**: Add RabbitMQ/Redis for async processing
3. **Caching Layer**: Implement Redis caching strategies
4. **Search Integration**: Add Elasticsearch for product search
5. **Monitoring**: Add Prometheus, Grafana for observability
6. **CI/CD Pipeline**: GitHub Actions for automated testing/deployment
7. **Load Balancing**: Nginx configuration for scaling
8. **Database Optimization**: Query optimization, connection pooling

## Key Files Created

<filepath>ecommerce-api/</filepath> - Complete e-commerce API project
- Core modules: auth, users, products, cart, orders, payments
- Advanced features: reviews, uploads, admin panel
- Production-ready configuration and documentation
- Industry-standard security and architecture patterns

This project demonstrates enterprise-level backend development practices and provides hands-on experience with the technologies and patterns used by major tech companies in their e-commerce platforms.