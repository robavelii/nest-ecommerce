# Test Coverage Report

## E2E Tests

- [x] Authentication Flow (register, login, logout, refresh tokens, password reset)
- [x] Products CRUD (create, read, update, delete with auth checks)
- [x] Cart Operations (add, update, remove, clear)
- [x] Order Management (create, filter, cancel, status updates)
- [x] Coupons (create, list, retrieve by ID)
- [x] Rate Limiting
- [x] Error Handling (404, 401, 403)
- [x] Health Checks

## Unit Tests

- [x] AuthService (register, login, refresh tokens, password reset, change password, OAuth validation)
- [x] ProductsService (CRUD, stock management, filtering, related products)
- [x] EmailService (send email, templates, password reset, welcome, order confirmation)
- [x] OrdersService (create, cancel, status updates, statistics)
- [x] CouponsService (create, apply, validation, usage tracking)
- [x] AuditService (log, filter by user/resource/action/date)

## Integration Tests

- [x] Complete user registration to login flow
- [x] Product creation and order with stock updates
- [x] Coupon creation and application to orders
- [x] Audit log creation
- [x] Database transactions (commit/rollback)
- [x] Data integrity constraints (unique email, SKU)
- [x] Concurrent operations (stock updates)

## Test Coverage Goals

- **Lines**: 70%+
- **Branches**: 70%+
- **Functions**: 70%+
- **Statements**: 70%+

## Test Utilities

- TestFactory: Provides factory methods for creating test data
- Test DB utilities: Create, truncate, close test database connections
- Mock configurations: ConfigService, Logger, Email service mocks

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run E2E tests only
npm run test:e2e

# Watch mode
npm run test:watch

# Debug tests
npm run test:debug
```

## Test Database Setup

Tests use a separate PostgreSQL database `ecommerce_test` to avoid conflicts with development data.

```bash
# Create test database
createdb ecommerce_test

# Drop test database
dropdb ecommerce_test
```
