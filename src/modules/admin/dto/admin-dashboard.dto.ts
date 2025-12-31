import { ApiProperty } from '@nestjs/swagger';
import { Order } from '../../../database/entities/order.entity';

export class TopProductDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  productId: string;

  @ApiProperty({ example: 'iPhone 13' })
  productName: string;

  @ApiProperty({ example: 150 })
  totalSold: number;

  @ApiProperty({ example: 149850.00 })
  revenue: number;
}

export class OrderStatusDto {
  @ApiProperty({ example: 'DELIVERED' })
  status: string;

  @ApiProperty({ example: 45 })
  count: number;
}

export class AdminDashboardDto {
  @ApiProperty({ description: 'Total number of users', example: 1250 })
  totalUsers: number;

  @ApiProperty({ description: 'Total number of products', example: 350 })
  totalProducts: number;

  @ApiProperty({ description: 'Total number of orders', example: 2450 })
  totalOrders: number;

  @ApiProperty({ description: 'Total number of reviews', example: 1200 })
  totalReviews: number;

  @ApiProperty({ description: 'New users this month', example: 89 })
  monthlyUsers: number;

  @ApiProperty({ description: 'User growth percentage', example: 12.5 })
  userGrowth: number;

  @ApiProperty({ description: 'Orders this month', example: 245 })
  monthlyOrders: number;

  @ApiProperty({ description: 'Order growth percentage', example: 8.3 })
  orderGrowth: number;

  @ApiProperty({ description: 'Revenue this month', example: 45650.75 })
  monthlyRevenue: number;

  @ApiProperty({ description: 'Revenue growth percentage', example: 15.2 })
  revenueGrowth: number;

  @ApiProperty({ description: 'Recent orders', type: [Order] })
  recentOrders: Order[];

  @ApiProperty({ description: 'Top selling products', type: [TopProductDto] })
  topProducts: TopProductDto[];

  @ApiProperty({ description: 'Orders grouped by status', type: [OrderStatusDto] })
  ordersByStatus: OrderStatusDto[];
}