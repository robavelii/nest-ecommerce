import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { User } from '../../database/entities/user.entity';
import { Product } from '../../database/entities/product.entity';
import { Order } from '../../database/entities/order.entity';
import { OrderItem } from '../../database/entities/order-item.entity';
import { OrderStatus } from '../../database/entities/order.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
  ) {}

  async create(createReviewDto: CreateReviewDto, userId: string): Promise<Review> {
    const { productId, rating, comment } = createReviewDto;

    // Check if product exists
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user has purchased this product and order is delivered
    const orderItem = await this.orderItemRepository.findOne({
      where: {
        product: { id: productId },
        order: {
          user: { id: userId },
          status: OrderStatus.DELIVERED,
        },
      },
      relations: ['order'],
    });

    if (!orderItem) {
      throw new BadRequestException(
        'You can only review products you have purchased and received',
      );
    }

    // Check if user has already reviewed this product
    const existingReview = await this.reviewRepository.findOne({
      where: {
        product: { id: productId },
        user: { id: userId },
      },
    });

    if (existingReview) {
      throw new BadRequestException(
        'You have already reviewed this product',
      );
    }

    const review = this.reviewRepository.create({
      rating,
      comment,
      product: { id: productId },
      user: { id: userId },
    });

    const savedReview = await this.reviewRepository.save(review);

    // Update product rating
    await this.updateProductRating(productId);

    return this.findOne(savedReview.id);
  }

  async findAll(
    productId?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Review[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .leftJoinAndSelect('review.product', 'product')
      .select([
        'review',
        'user.id',
        'user.firstName',
        'user.lastName',
        'product.id',
        'product.name',
      ])
      .orderBy('review.createdAt', 'DESC');

    if (productId) {
      queryBuilder.where('review.productId = :productId', { productId });
    }

    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const reviews = await queryBuilder.skip(offset).take(limit).getMany();

    return {
      data: reviews,
      total,
      page,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user', 'product'],
      select: {
        user: {
          id: true,
          firstName: true,
          lastName: true,
        },
        product: {
          id: true,
          name: true,
        },
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user', 'product'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.user.id !== userId) {
      throw new ForbiddenException('You can only update your own reviews');
    }

    Object.assign(review, updateReviewDto);
    const updatedReview = await this.reviewRepository.save(review);

    // Update product rating if rating was changed
    if (updateReviewDto.rating !== undefined) {
      await this.updateProductRating(review.product.id);
    }

    return this.findOne(updatedReview.id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['user', 'product'],
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.user.id !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    const productId = review.product.id;
    await this.reviewRepository.remove(review);

    // Update product rating after deletion
    await this.updateProductRating(productId);
  }

  async getProductReviewStats(productId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    ratingDistribution: { rating: number; count: number }[];
  }> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [totalReviews, ratingStats] = await Promise.all([
      this.reviewRepository.count({
        where: { product: { id: productId } },
      }),
      this.reviewRepository
        .createQueryBuilder('review')
        .select('review.rating', 'rating')
        .addSelect('COUNT(*)', 'count')
        .where('review.productId = :productId', { productId })
        .groupBy('review.rating')
        .orderBy('review.rating', 'ASC')
        .getRawMany(),
    ]);

    const averageRating = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .where('review.productId = :productId', { productId })
      .getRawOne();

    // Create rating distribution array (1-5 stars)
    const ratingDistribution = [];
    for (let i = 1; i <= 5; i++) {
      const stat = ratingStats.find((s) => parseInt(s.rating) === i);
      ratingDistribution.push({
        rating: i,
        count: stat ? parseInt(stat.count) : 0,
      });
    }

    return {
      totalReviews,
      averageRating: averageRating?.average ? parseFloat(averageRating.average) : 0,
      ratingDistribution,
    };
  }

  private async updateProductRating(productId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'totalReviews')
      .where('review.productId = :productId', { productId })
      .getRawOne();

    const averageRating = result?.averageRating
      ? parseFloat(result.averageRating)
      : 0;
    const totalReviews = result?.totalReviews ? parseInt(result.totalReviews) : 0;

    await this.productRepository.update(productId, {
      averageRating,
      reviewCount: totalReviews,
    });
  }

  async getUserReviews(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    data: Review[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.reviewRepository
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.product', 'product')
      .where('review.userId = :userId', { userId })
      .orderBy('review.createdAt', 'DESC');

    const total = await queryBuilder.getCount();
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const reviews = await queryBuilder.skip(offset).take(limit).getMany();

    return {
      data: reviews,
      total,
      page,
      totalPages,
    };
  }
}