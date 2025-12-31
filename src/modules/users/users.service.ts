import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Address } from '../../database/entities/address.entity';
import { Wishlist } from '../../database/entities/wishlist.entity';
import { Order } from '../../database/entities/order.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { LoggerServiceImpl as CustomLogger } from '../../common/logger/logger.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly logger: CustomLogger,
  ) {}

  // ========================================
  // Profile Management
  // ========================================

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['addresses'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);

    Object.assign(user, updateProfileDto);
    await this.userRepository.save(user);

    this.logger.log(`Profile updated for user: ${user.email}`, 'UsersService');
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.password) {
      throw new BadRequestException('Cannot change password');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = newPassword;
    await this.userRepository.save(user);

    this.logger.log(`Password changed for user: ${user.email}`, 'UsersService');
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    const { password, refreshToken, resetPasswordToken, ...safeUser } = user;
    return safeUser;
  }

  // ========================================
  // Address Management
  // ========================================

  async getAddresses(userId: string): Promise<Address[]> {
    return this.addressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async addAddress(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    // If this is the first address or marked as default, update others
    if (createAddressDto.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    } else {
      const existingAddresses = await this.addressRepository.count({ where: { userId } });
      if (existingAddresses === 0) {
        createAddressDto.isDefault = true;
      }
    }

    const address = this.addressRepository.create({
      ...createAddressDto,
      userId,
    });

    await this.addressRepository.save(address);
    this.logger.log(`Address added for user: ${userId}`, 'UsersService');

    return address;
  }

  async updateAddress(userId: string, addressId: string, updateAddressDto: UpdateAddressDto): Promise<Address> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If marking as default, unmark others
    if (updateAddressDto.isDefault && !address.isDefault) {
      await this.addressRepository.update(
        { userId, isDefault: true },
        { isDefault: false },
      );
    }

    Object.assign(address, updateAddressDto);
    await this.addressRepository.save(address);

    return address;
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.addressRepository.findOne({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    const wasDefault = address.isDefault;
    await this.addressRepository.remove(address);

    // If deleted address was default, set a new default
    if (wasDefault) {
      const nextAddress = await this.addressRepository.findOne({
        where: { userId },
        order: { createdAt: 'ASC' },
      });

      if (nextAddress) {
        nextAddress.isDefault = true;
        await this.addressRepository.save(nextAddress);
      }
    }

    this.logger.log(`Address deleted for user: ${userId}`, 'UsersService');
  }

  // ========================================
  // Wishlist Management
  // ========================================

  async getWishlist(userId: string) {
    return this.wishlistRepository.find({
      where: { userId },
      relations: ['product'],
      order: { createdAt: 'DESC' },
    });
  }

  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    // Check if already in wishlist
    const existing = await this.wishlistRepository.findOne({
      where: { userId, productId },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    const wishlistItem = this.wishlistRepository.create({
      userId,
      productId,
    });

    await this.wishlistRepository.save(wishlistItem);
    this.logger.log(`Product ${productId} added to wishlist for user: ${userId}`, 'UsersService');

    return wishlistItem;
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const wishlistItem = await this.wishlistRepository.findOne({
      where: { userId, productId },
    });

    if (!wishlistItem) {
      throw new NotFoundException('Product not in wishlist');
    }

    await this.wishlistRepository.remove(wishlistItem);
    this.logger.log(`Product ${productId} removed from wishlist for user: ${userId}`, 'UsersService');
  }

  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const item = await this.wishlistRepository.findOne({
      where: { userId, productId },
    });
    return !!item;
  }

  // ========================================
  // Order History
  // ========================================

  async getOrderHistory(userId: string, page = 1, limit = 10) {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOrderById(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'payments'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  // ========================================
  // Admin Functions
  // ========================================

  async findAll(page = 1, limit = 10, search?: string) {
    const queryBuilder = this.userRepository.createQueryBuilder('u');

    if (search) {
      queryBuilder.where(
        '(u.email ILIKE :search OR u.firstName ILIKE :search OR u.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [users, total] = await queryBuilder
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map(({ password, refreshToken, ...user }) => user),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(userId);
    Object.assign(user, updateData);
    await this.userRepository.save(user);
    return user;
  }

  async updateUserRole(userId: string, role: string): Promise<User> {
    const user = await this.findById(userId);
    user.role = role as any;
    await this.userRepository.save(user);
    this.logger.log(`User ${user.email} role updated to ${role}`, 'UsersService');
    return user;
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: false });
    this.logger.log(`User ${userId} deactivated`, 'UsersService');
  }

  async activateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isActive: true });
    this.logger.log(`User ${userId} activated`, 'UsersService');
  }
}
