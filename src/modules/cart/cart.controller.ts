import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/public.decorator';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get cart items' })
  @ApiResponse({ status: 200, description: 'Returns cart with summary' })
  async getCart(@CurrentUser('userId') userId: string) {
    return this.cartService.getCartSummary(userId);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get cart item count' })
  @ApiResponse({ status: 200, description: 'Returns item count' })
  async getCartCount(@CurrentUser('userId') userId: string) {
    const count = await this.cartService.getCartItemCount(userId);
    return { count };
  }

  @Post('items')
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  async addToCart(
    @CurrentUser('userId') userId: string,
    @Body() addToCartDto: AddToCartDto,
  ) {
    return this.cartService.addToCart(userId, addToCartDto);
  }

  @Put('items/:productId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  async updateCartItem(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() updateCartItemDto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(userId, productId, updateCartItemDto);
  }

  @Delete('items/:productId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Item removed from cart' })
  async removeFromCart(
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.cartService.removeFromCart(userId, productId);
    return { message: 'Item removed from cart' };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  async clearCart(@CurrentUser('userId') userId: string) {
    await this.cartService.clearCart(userId);
    return { message: 'Cart cleared' };
  }
}
