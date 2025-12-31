import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { LoggerServiceImpl } from "../../src/common/logger/logger.service";
import { ProductsService } from "../../src/modules/products/products.service";
import {
  Product,
  ProductStatus,
} from "../../src/database/entities/product.entity";
import { ProductVariant } from "../../src/database/entities/product-variant.entity";
import { Category } from "../../src/database/entities/category.entity";
import { Review } from "../../src/database/entities/review.entity";
import { ProductImage } from "../../src/database/entities/product-image.entity";
import { TestFactory } from "../factories/test.factory";

describe("ProductsService", () => {
  let service: ProductsService;
  let productRepository: Repository<Product>;
  let variantRepository: Repository<ProductVariant>;
  let categoryRepository: Repository<Category>;
  let reviewRepository: Repository<Review>;
  let imageRepository: Repository<ProductImage>;

  const mockConfigService: any = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {};
      return config[key];
    }),
  };

  const mockLogger: any = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerServiceImpl,
          useValue: mockLogger,
        },
        {
          provide: getRepositoryToken(Product),
          useFactory: () => ({
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
              getOne: jest.fn(),
              innerJoin: jest.fn().mockReturnThis(),
            })),
          }),
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: {
            findOne: jest.fn(),
            remove: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Review),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(),
              getRawMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(ProductImage),
          useValue: {
            findOne: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productRepository = module.get<Repository<Product>>(
      getRepositoryToken(Product),
    );
    variantRepository = module.get<Repository<ProductVariant>>(
      getRepositoryToken(ProductVariant),
    );
    categoryRepository = module.get<Repository<Category>>(
      getRepositoryToken(Category),
    );
    reviewRepository = module.get<Repository<Review>>(
      getRepositoryToken(Review),
    );
    imageRepository = module.get<Repository<ProductImage>>(
      getRepositoryToken(ProductImage),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    it("should return paginated products", async () => {
      const mockProducts = [
        TestFactory.createProduct({ id: "prod-1" }),
        TestFactory.createProduct({ id: "prod-2" }),
      ];

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockProducts, 2]),
      };

      (productRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("meta");
      expect(result.data).toEqual(mockProducts);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by search term", async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (productRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({ search: "test", page: 1, limit: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("ILIKE"),
        { search: expect.any(String) },
      );
    });

    it("should filter by price range", async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (productRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({
        minPrice: 10,
        maxPrice: 100,
        page: 1,
        limit: 10,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "product.price >= :minPrice",
        { minPrice: 10 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "product.price <= :maxPrice",
        { maxPrice: 100 },
      );
    });

    it("should filter by stock availability", async () => {
      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      (productRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder,
      );

      await service.findAll({ inStock: true, page: 1, limit: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "product.stock > 0",
      );
    });
  });

  describe("findOne", () => {
    it("should return product by ID", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        name: "Test Product",
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (productRepository.increment as jest.Mock).mockResolvedValue(undefined);

      const result = await service.findOne("prod-123");

      expect(result).toEqual(mockProduct);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: "prod-123" },
        relations: expect.arrayContaining([
          "category",
          "variants",
          "imagesRelation",
          "productTags",
          "reviews",
        ]),
      });
      expect(productRepository.increment).toHaveBeenCalled();
    });

    it("should throw NotFoundException if product not found", async () => {
      (productRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        "Product with ID non-existent not found",
      );
    });
  });

  describe("create", () => {
    it("should create a new product", async () => {
      const productData = TestFactory.createProduct({
        sku: "NEW-SKU-123",
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(null);
      (productRepository.create as jest.Mock).mockReturnValue(productData);
      (productRepository.save as jest.Mock).mockResolvedValue({
        id: "prod-123",
        ...productData,
      });

      const result = await service.create(productData as any, "user-123");

      expect(result).toHaveProperty("id", "prod-123");
      expect(result).toHaveProperty("status", ProductStatus.DRAFT);
      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { sku: productData.sku },
      });
      expect(productRepository.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw ConflictException for duplicate SKU", async () => {
      const productData = TestFactory.createProduct({
        sku: "DUP-SKU",
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue({
        id: "existing-prod",
      });

      await expect(
        service.create(productData as any, "user-123"),
      ).rejects.toThrow("Product with this SKU already exists");
    });
  });

  describe("update", () => {
    it("should update product", async () => {
      const existingProduct = TestFactory.createProduct({
        id: "prod-123",
        sku: "OLD-SKU",
        name: "Old Name",
      });

      const updateData = { name: "New Name", price: 39.99 };

      (productRepository.findOne as jest.Mock).mockResolvedValue(
        existingProduct,
      );
      (productRepository.findOne as jest.Mock).mockResolvedValue(null);
      (productRepository.save as jest.Mock).mockResolvedValue({
        ...existingProduct,
        ...updateData,
      });

      const result = await service.update("prod-123", updateData);

      expect(result.name).toBe(updateData.name);
      expect(result.price).toBe(updateData.price);
      expect(productRepository.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw ConflictException for duplicate SKU on update", async () => {
      const existingProduct = TestFactory.createProduct({
        id: "prod-123",
        sku: "OLD-SKU",
        name: "Old Name",
      });

      const updateData = { sku: "DUP-SKU" };

      (productRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(existingProduct)
        .mockResolvedValueOnce({ id: "other-prod" });

      await expect(service.update("prod-123", updateData)).rejects.toThrow(
        "Product with this SKU already exists",
      );
    });
  });

  describe("remove", () => {
    it("should delete product", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        name: "To Delete",
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (productRepository.remove as jest.Mock).mockResolvedValue(undefined);

      await service.remove("prod-123");

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: "prod-123" },
      });
      expect(productRepository.remove).toHaveBeenCalledWith(mockProduct);
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw NotFoundException if product not found", async () => {
      (productRepository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.remove("non-existent")).rejects.toThrow(
        "Product with ID non-existent not found",
      );
    });
  });

  describe("updateStatus", () => {
    it("should update product status", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        status: ProductStatus.DRAFT,
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (productRepository.save as jest.Mock).mockResolvedValue({
        ...mockProduct,
        status: ProductStatus.ACTIVE,
      });

      const result = await service.updateStatus(
        "prod-123",
        ProductStatus.ACTIVE,
      );

      expect(result.status).toBe(ProductStatus.ACTIVE);
      expect(productRepository.save).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe("updateStock", () => {
    it("should update product stock", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        stock: 50,
      });

      (productRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockProduct)
        .mockResolvedValueOnce({ ...mockProduct, stock: 45 });

      (productRepository.update as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updateStock("prod-123", -5);

      expect(result.stock).toBe(45);
      expect(productRepository.update).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalled();
    });

    it("should throw BadRequestException for insufficient stock", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        stock: 5,
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);

      await expect(service.updateStock("prod-123", -10)).rejects.toThrow(
        "Insufficient stock",
      );
    });
  });

  describe("reserveStock", () => {
    it("should reserve stock for multiple items", async () => {
      const items = [
        { productId: "prod-1", quantity: 5 },
        { productId: "prod-2", quantity: 3 },
      ];

      const mockProducts = items.map((item) =>
        TestFactory.createProduct({ id: item.productId, stock: 20 }),
      );

      (productRepository.findOne as jest.Mock)
        .mockResolvedValueOnce(mockProducts[0])
        .mockResolvedValueOnce(mockProducts[1]);

      (productRepository.decrement as jest.Mock).mockResolvedValue(undefined);

      const result = await service.reserveStock(items);

      expect(result).toBe(true);
      expect(productRepository.decrement).toHaveBeenCalledTimes(2);
    });

    it("should return false for insufficient stock", async () => {
      const items = [{ productId: "prod-1", quantity: 50 }];

      const mockProduct = TestFactory.createProduct({
        id: "prod-1",
        stock: 10,
      });

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);

      const result = await service.reserveStock(items);

      expect(result).toBe(false);
    });
  });

  describe("getRelatedProducts", () => {
    it("should return related products by category", async () => {
      const mockProduct = TestFactory.createProduct({
        id: "prod-123",
        categoryId: "cat-1",
      });

      const mockRelatedProducts = [
        TestFactory.createProduct({ id: "prod-1", categoryId: "cat-1" }),
        TestFactory.createProduct({ id: "prod-2", categoryId: "cat-1" }),
        TestFactory.createProduct({ id: "prod-3", categoryId: "cat-1" }),
        TestFactory.createProduct({ id: "prod-4", categoryId: "cat-1" }),
        TestFactory.createProduct({ id: "prod-123", categoryId: "cat-1" }),
      ];

      (productRepository.findOne as jest.Mock).mockResolvedValue(mockProduct);
      (productRepository.find as jest.Mock).mockResolvedValue(
        mockRelatedProducts,
      );

      const result = await service.getRelatedProducts("prod-123", 4);

      expect(result.length).toBeLessThanOrEqual(4);
      expect(result).not.toContainEqual(
        expect.objectContaining({ id: "prod-123" }),
      );
    });
  });

  describe("getFeaturedProducts", () => {
    it("should return highly rated products", async () => {
      const mockFeaturedProducts = [
        TestFactory.createProduct({
          id: "prod-1",
          averageRating: 5,
          soldCount: 100,
        }),
        TestFactory.createProduct({
          id: "prod-2",
          averageRating: 4.5,
          soldCount: 80,
        }),
        TestFactory.createProduct({
          id: "prod-3",
          averageRating: 4.2,
          soldCount: 60,
        }),
      ];

      (productRepository.find as jest.Mock).mockResolvedValue(
        mockFeaturedProducts,
      );

      const result = await service.getFeaturedProducts(3);

      expect(result).toEqual(mockFeaturedProducts);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: {
          status: ProductStatus.ACTIVE,
          averageRating: expect.any(Number),
        },
        order: {
          soldCount: "DESC",
        },
        take: 3,
      });
    });
  });
});
