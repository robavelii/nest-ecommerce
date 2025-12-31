import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../database/entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { LoggerServiceImpl as CustomLogger } from '../../common/logger/logger.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly logger: CustomLogger,
  ) {}

  async findAll(parentId?: string, active = true) {
    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.children', 'children')
      .leftJoinAndSelect('category.products', 'products');

    if (parentId === 'null' || parentId === null) {
      queryBuilder.where('category.parentId IS NULL');
    } else if (parentId) {
      queryBuilder.where('category.parentId = :parentId', { parentId });
    }

    if (active) {
      queryBuilder.andWhere('category.active = :active', { active: true });
    }

    queryBuilder.orderBy('category.sortOrder', 'ASC');

    const categories = await queryBuilder.getMany();
    return categories;
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['children', 'products'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { slug },
      relations: ['children', 'products'],
    });

    if (!category) {
      throw new NotFoundException(`Category with slug ${slug} not found`);
    }

    return category;
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    // Check if slug already exists
    const existing = await this.categoryRepository.findOne({
      where: { slug: createCategoryDto.slug },
    });

    if (existing) {
      throw new ConflictException('Category with this slug already exists');
    }

    const category = this.categoryRepository.create(createCategoryDto);
    await this.categoryRepository.save(category);

    this.logger.log(`Category created: ${category.name}`, 'CategoriesService');
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    // Check slug uniqueness if being updated
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existing = await this.categoryRepository.findOne({
        where: { slug: updateCategoryDto.slug },
      });

      if (existing) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    Object.assign(category, updateCategoryDto);
    await this.categoryRepository.save(category);

    this.logger.log(`Category updated: ${category.name}`, 'CategoriesService');
    return category;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    // Check if category has children
    if (category.children && category.children.length > 0) {
      throw new ConflictException('Cannot delete category with child categories');
    }

    // Check if category has products
    if (category.products && category.products.length > 0) {
      throw new ConflictException('Cannot delete category with associated products');
    }

    await this.categoryRepository.remove(category);
    this.logger.log(`Category deleted: ${category.name}`, 'CategoriesService');
  }

  async getCategoryProducts(
    id: string,
    page = 1,
    limit = 12,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    await this.findOne(id); // Verify category exists

    const [products, total] = await this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.products', 'product')
      .where('category.id = :id', { id })
      .andWhere('product.status = :status', { status: 'active' })
      .orderBy(`product.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: products[0]?.products || [],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCategoryTree() {
    const rootCategories = await this.findAll(null, true);
    
    const buildTree = (categories: Category[]): any[] => {
      return categories.map(category => ({
        ...category,
        children: category.children ? buildTree(category.children) : [],
        productCount: category.products?.length || 0,
      }));
    };

    return buildTree(rootCategories);
  }

  async reorderCategories(categories: { id: string; sortOrder: number }[]): Promise<void> {
    for (const cat of categories) {
      await this.categoryRepository.update(cat.id, { sortOrder: cat.sortOrder });
    }
    this.logger.log('Categories reordered', 'CategoriesService');
  }
}
