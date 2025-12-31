import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from '../../database/entities/cart-item.entity';
import { Product, ProductStatus } from '../../database/entities/product.entity';
import { ProductVariant } from '../../database/entities/product-variant.entity';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { LoggerServiceImpl as CustomLogger } from '../../common/logger/logger.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly logger: CustomLogger,
  ) {}

  async getCart(userId: string): Promise<CartItem[]> {
    return this.cartItemRepository.find({
      where: { userId },
      relations: ['product', 'variant'],
      order: { createdAt: 'DESC' },
    });
  }

  async getCartSummary(userId: string) {
    const items = await this.getCart(userId);

    let subtotal = 0;
    let itemCount = 0;

    const validItems = [];

    for (const item of items) {
      if (!item.product || item.product.status !== ProductStatus.ACTIVE) {
        continue;
      }

      const price = item.variant?.price || item.product.price;
      const itemTotal = price * item.quantity;
      subtotal += itemTotal;
      itemCount += item.quantity;

      validItems.push({
        ...item,
        product: item.product,
        variant: item.variant,
        price,
        total: itemTotal,
      });
    }

    return {
      items: validItems,
      summary: {
        itemCount,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(subtotal * 0.08 * 100) / 100, // 8% tax
        shipping: subtotal > 100 ? 0 : 10, // Free shipping over $100
        total: Math.round((subtotal + subtotal * 0.08 + (subtotal > 100 ? 0 : 10)) * 100) / 100,
      },
    };
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto): Promise<CartItem> {
    // Validate product
    const product = await this.productRepository.findOne({
      where: { id: addToCartDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status !== ProductStatus.ACTIVE) {
      throw new BadRequestException('Product is not available');
    }

    // Validate variant if provided
    let variant: ProductVariant | null = null;
    if (addToCartDto.variantId) {
      variant = await this.variantRepository.findOne({
        where: { id: addToCartDto.variantId, productId: addToCartDto.productId },
      });

      if (!variant || !variant.active) {
        throw new NotFoundException('Product variant not found');
      }
    }

    // Check stock
    const availableStock = variant?.stock ?? product.stock;
    if (availableStock < addToCartDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${availableStock} items available.`,
      );
    }

    // Check if item already in cart
    const existingItem = await this.cartItemRepository.findOne({
      where: {
        userId,
        productId: addToCartDto.productId,
        variantId: addToCartDto.variantId,
      },
    });

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addToCartDto.quantity;
      
      if (availableStock < newQuantity) {
        throw new BadRequestException(
          `Insufficient stock. Only ${availableStock} items available.`,
        );
      }

      existingItem.quantity = newQuantity;
      await this.cartItemRepository.save(existingItem);

      this.logger.log(`Cart updated: ${product.name} quantity changed`, 'CartService');
      return existingItem;
    }

    // Create new cart item
    const cartItem = this.cartItemRepository.create({
      userId,
      productId: addToCartDto.productId,
      variantId: addToCartDto.variantId,
      quantity: addToCartDto.quantity,
    });

    await this.cartItemRepository.save(cartItem);

    this.logger.log(`Product added to cart: ${product.name}`, 'CartService');
    return cartItem;
  }

  async updateCartItem(
    userId: string,
    productId: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { userId, productId },
      relations: ['product', 'variant'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    // Validate new quantity
    const availableStock = cartItem.variant?.stock ?? cartItem.product?.stock ?? 0;
    if (updateCartItemDto.quantity > availableStock) {
      throw new BadRequestException(
        `Insufficient stock. Only ${availableStock} items available.`,
      );
    }

    cartItem.quantity = updateCartItemDto.quantity;
    await this.cartItemRepository.save(cartItem);

    this.logger.log(`Cart item updated: ${cartItem.productId}`, 'CartService');
    return cartItem;
  }

  async removeFromCart(userId: string, productId: string): Promise<void> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { userId, productId },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);
    this.logger.log(`Product removed from cart: ${productId}`, 'CartService');
  }

  async clearCart(userId: string): Promise<void> {
    await this.cartItemRepository.delete({ userId });
    this.logger.log(`Cart cleared for user: ${userId}`, 'CartService');
  }

  async getCartItemCount(userId: string): Promise<number> {
    return this.cartItemRepository.count({
      where: { userId },
    });
  }

  async validateCartForCheckout(userId: string): Promise<{
    valid: boolean;
    items: Array<{
      productId: string;
      variantId?: string;
      requested: number;
      available: number;
    }>;
  }> {
    const items = await this.cartItemRepository.find({
      where: { userId },
      relations: ['product', 'variant'],
    });

    const invalidItems = [];

    for (const item of items) {
      if (!item.product || item.product.status !== ProductStatus.ACTIVE) {
        invalidItems.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available: 0,
        });
        continue;
      }

      const availableStock = item.variant?.stock ?? item.product.stock;
      if (item.quantity > availableStock) {
        invalidItems.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available: availableStock,
        });
      }
    }

    return {
      valid: invalidItems.length === 0,
      items: invalidItems,
    };
  }

  async removeInvalidItems(userId: string): Promise<void> {
    const cartItems = await this.cartItemRepository.find({
      where: { userId },
      relations: ['product', 'variant'],
    });

    for (const item of cartItems) {
      if (!item.product || item.product.status !== ProductStatus.ACTIVE) {
        await this.cartItemRepository.remove(item);
        continue;
      }

      const availableStock = item.variant?.stock ?? item.product.stock;
      if (item.quantity > availableStock) {
        await this.cartItemRepository.remove(item);
      }
    }
  }
}
