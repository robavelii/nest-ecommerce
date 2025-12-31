import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Product, ProductStatus } from "../../database/entities/product.entity";
import { ProductVariant } from "../../database/entities/product-variant.entity";
import { ProductImage } from "../../database/entities/product-image.entity";
import { ProductTag } from "../../database/entities/product-tag.entity";
import { Category } from "../../database/entities/category.entity";
import { Review } from "../../database/entities/review.entity";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ProductFilterDto } from "./dto/product-filter.dto";
import { LoggerServiceImpl as CustomLogger } from "../../common/logger/logger.service";

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly imageRepository: Repository<ProductImage>,
    @InjectRepository(ProductTag)
    private readonly tagRepository: Repository<ProductTag>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(filterDto: ProductFilterDto) {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      minPrice,
      maxPrice,
      inStock,
      sortBy = "createdAt",
      sortOrder = "DESC",
      status = "active",
      tags,
    } = filterDto;

    const queryBuilder = this.productRepository
      .createQueryBuilder("product")
      .leftJoinAndSelect("product.category", "category")
      .leftJoinAndSelect("product.imagesRelation", "image")
      .leftJoinAndSelect("product.variants", "variant");

    // Search
    if (search) {
      queryBuilder.andWhere(
        "(product.name ILIKE :search OR product.description ILIKE :search OR product.sku ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    // Category filter
    if (category) {
      queryBuilder.andWhere("category.slug = :category", { category });
    }

    // Price range
    if (minPrice !== undefined) {
      queryBuilder.andWhere("product.price >= :minPrice", { minPrice });
    }
    if (maxPrice !== undefined) {
      queryBuilder.andWhere("product.price <= :maxPrice", { maxPrice });
    }

    // Stock filter
    if (inStock) {
      queryBuilder.andWhere("product.stock > 0");
    }

    // Status filter
    if (status) {
      queryBuilder.andWhere("product.status = :status", { status });
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim());
      queryBuilder
        .innerJoin("product.productTags", "tag")
        .andWhere("tag.tag IN (:...tags)", { tags: tagArray });
    }

    // Sorting
    const validSortFields = [
      "price",
      "createdAt",
      "soldCount",
      "averageRating",
      "viewCount",
    ];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    queryBuilder.orderBy(`product.${sortField}`, sortOrder);

    const [products, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: [
        "category",
        "variants",
        "imagesRelation",
        "productTags",
        "reviews",
      ],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Increment view count
    await this.productRepository.increment({ id }, "viewCount", 1);

    return product;
  }

  async findBySku(sku: string): Promise<Product | null> {
    return this.productRepository.findOne({
      where: { sku },
      relations: ["category", "variants", "imagesRelation"],
    });
  }

  async create(
    createProductDto: CreateProductDto,
    userId?: string,
  ): Promise<Product> {
    // Check SKU uniqueness
    const existing = await this.findBySku(createProductDto.sku);
    if (existing) {
      throw new ConflictException("Product with this SKU already exists");
    }

    const product = this.productRepository.create({
      ...createProductDto,
      sellerId: userId,
      status: ProductStatus.DRAFT,
    });

    await this.productRepository.save(product);

    // Handle tags
    if (createProductDto.tags && createProductDto.tags.length > 0) {
      await this.addTags(product.id, createProductDto.tags);
    }

    this.logger.log(
      `Product created: ${product.name} (${product.sku})`,
      "ProductsService",
    );
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Check SKU uniqueness if being updated
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.findBySku(updateProductDto.sku);
      if (existing) {
        throw new ConflictException("Product with this SKU already exists");
      }
    }

    Object.assign(product, updateProductDto);
    await this.productRepository.save(product);

    // Update tags if provided
    if (updateProductDto.tags) {
      await this.tagRepository.delete({ productId: id });
      await this.addTags(id, updateProductDto.tags);
    }

    this.logger.log(
      `Product updated: ${product.name} (${product.sku})`,
      "ProductsService",
    );
    return product;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findOne(id);
    await this.productRepository.remove(product);
    this.logger.log(
      `Product deleted: ${product.name} (${product.sku})`,
      "ProductsService",
    );
  }

  async updateStatus(id: string, status: ProductStatus): Promise<Product> {
    const product = await this.findOne(id);
    product.status = status;
    await this.productRepository.save(product);
    this.logger.log(
      `Product ${product.sku} status changed to ${status}`,
      "ProductsService",
    );
    return product;
  }

  async publish(id: string): Promise<Product> {
    return this.updateStatus(id, ProductStatus.ACTIVE);
  }

  async archive(id: string): Promise<Product> {
    return this.updateStatus(id, ProductStatus.ARCHIVED);
  }

  // ========================================
  // Variants Management
  // ========================================

  async addVariant(
    productId: string,
    variantDto: CreateVariantDto,
  ): Promise<ProductVariant> {
    await this.findOne(productId); // Verify product exists

    const variant = this.variantRepository.create({
      ...variantDto,
      productId,
    });

    await this.variantRepository.save(variant);
    this.logger.log(`Variant added to product ${productId}`, "ProductsService");

    return variant;
  }

  async updateVariant(
    variantId: string,
    variantDto: Partial<CreateVariantDto>,
  ): Promise<ProductVariant> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    Object.assign(variant, variantDto);
    await this.variantRepository.save(variant);

    return variant;
  }

  async removeVariant(variantId: string): Promise<void> {
    const variant = await this.variantRepository.findOne({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException("Variant not found");
    }

    await this.variantRepository.remove(variant);
  }

  // ========================================
  // Images Management
  // ========================================

  async addImage(
    productId: string,
    imageData: { url: string; publicId?: string; alt?: string },
  ): Promise<ProductImage> {
    await this.findOne(productId);

    // Set first image as primary if no primary exists
    const existingPrimary = await this.imageRepository.findOne({
      where: { productId, isPrimary: true },
    });

    const image = this.imageRepository.create({
      ...imageData,
      productId,
      isPrimary: !existingPrimary,
      sortOrder: await this.imageRepository.count({ where: { productId } }),
    });

    await this.imageRepository.save(image);
    return image;
  }

  async setPrimaryImage(imageId: string): Promise<void> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
      relations: ["product"],
    });

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    // Unset all other primary images
    await this.imageRepository.update(
      { productId: image.productId, isPrimary: true },
      { isPrimary: false },
    );

    // Set this image as primary
    image.isPrimary = true;
    await this.imageRepository.save(image);
  }

  async removeImage(imageId: string): Promise<void> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
    });

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    await this.imageRepository.remove(image);
  }

  // ========================================
  // Tags Management
  // ========================================

  private async addTags(productId: string, tags: string[]): Promise<void> {
    const tagEntities = tags.map((tag) => ({
      productId,
      tag,
    }));
    await this.tagRepository.save(tagEntities);
  }

  async getRelatedProducts(productId: string, limit = 4): Promise<Product[]> {
    const product = await this.findOne(productId);

    const related = await this.productRepository.find({
      where: {
        categoryId: product.categoryId,
        status: ProductStatus.ACTIVE,
      },
      take: limit + 1, // Get one extra to filter out current product
    });

    return related.filter((p) => p.id !== productId).slice(0, limit);
  }

  async getFeaturedProducts(limit = 8): Promise<Product[]> {
    return this.productRepository.find({
      where: {
        status: ProductStatus.ACTIVE,
        averageRating: 4.0 as any, // Products with 4+ rating
      },
      order: {
        soldCount: "DESC",
      },
      take: limit,
    });
  }

  async getProductReviews(productId: string, page = 1, limit = 10) {
    const [reviews, total] = await this.reviewRepository.findAndCount({
      where: { productId, isApproved: true },
      relations: ["user"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addReview(
    productId: string,
    userId: string,
    reviewDto: CreateReviewDto,
  ): Promise<Review> {
    // Check if user already reviewed this product
    const existing = await this.reviewRepository.findOne({
      where: { productId, userId },
    });

    if (existing) {
      throw new ConflictException("You have already reviewed this product");
    }

    const review = this.reviewRepository.create({
      ...reviewDto,
      productId,
      userId,
      isVerifiedPurchase: await this.isVerifiedPurchase(userId, productId),
    });

    await this.reviewRepository.save(review);

    // Update product rating
    await this.updateProductRating(productId);

    this.logger.log(`Review added for product ${productId}`, "ProductsService");
    return review;
  }

  private async isVerifiedPurchase(
    userId: string,
    productId: string,
  ): Promise<boolean> {
    // Check if user has completed order with this product
    const { OrderItem, Order } = await import("../../database/entities/index");
    const orderItem = await this.reviewRepository.manager.findOne(OrderItem, {
      where: {
        productId,
        order: {
          userId,
          status: "delivered" as any,
        },
      },
      relations: ["order"],
    });
    return !!orderItem;
  }

  private async updateProductRating(productId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder("review")
      .where("review.productId = :productId", { productId })
      .select("AVG(review.rating)", "avgRating")
      .addSelect("COUNT(review.id)", "reviewCount")
      .getRawOne();

    await this.productRepository.update(productId, {
      averageRating: parseFloat(result.avgRating) || 0,
      reviewCount: parseInt(result.reviewCount) || 0,
    });
  }

  // ========================================
  // Inventory Management
  // ========================================

  async updateStock(productId: string, quantity: number): Promise<Product> {
    const product = await this.findOne(productId);
    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw new BadRequestException("Insufficient stock");
    }

    await this.productRepository.update(productId, { stock: newStock });
    this.logger.log(
      `Product ${product.sku} stock updated: ${quantity}`,
      "ProductsService",
    );

    return this.findOne(productId);
  }

  async reserveStock(
    items: { productId: string; quantity: number }[],
  ): Promise<boolean> {
    for (const item of items) {
      const product = await this.findOne(item.productId);
      if (product.stock < item.quantity) {
        return false;
      }
    }

    // Deduct stock
    for (const item of items) {
      await this.productRepository.decrement(
        { id: item.productId },
        "stock",
        item.quantity,
      );
    }

    return true;
  }

  async releaseStock(
    items: { productId: string; quantity: number }[],
  ): Promise<void> {
    for (const item of items) {
      await this.productRepository.increment(
        { id: item.productId },
        "stock",
        item.quantity,
      );
    }
  }

  // ========================================
  // Seller Products
  // ========================================

  async getSellerProducts(sellerId: string, page = 1, limit = 10) {
    const [products, total] = await this.productRepository.findAndCount({
      where: { sellerId },
      relations: ["category", "imagesRelation"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLowStockProducts(threshold = 10): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder("product")
      .where("product.stock <= :threshold", { threshold })
      .andWhere("product.status = :status", { status: ProductStatus.ACTIVE })
      .orderBy("product.stock", "ASC")
      .getMany();
  }
}
