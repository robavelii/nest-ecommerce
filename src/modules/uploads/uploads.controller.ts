import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Delete,
  Param,
  BadRequestException,
  Get,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { UploadsService } from './uploads.service';
import { StorageFile } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../database/entities/user.entity';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('product-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - seller/admin role required' })
  async uploadProductImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StorageFile> {
    if (!file) {
      throw new BadRequestException('No image file provided');
    }

    return this.uploadsService.uploadSingle(file, 'products');
  }

  @Post('product-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 10))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload multiple product images (max 10)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid files or files too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - seller/admin role required' })
  async uploadProductImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<StorageFile[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image files provided');
    }

    return this.uploadsService.uploadMultiple(files, 'products');
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StorageFile> {
    if (!file) {
      throw new BadRequestException('No avatar file provided');
    }

    return this.uploadsService.uploadSingle(file, 'avatars');
  }

  @Delete('product/:filename')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product image' })
  @ApiParam({
    name: 'filename',
    description: 'Image filename to delete',
    example: 'uuid-filename.jpg',
  })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - seller/admin role required' })
  async deleteProductImage(@Param('filename') filename: string): Promise<{ message: string }> {
    await this.uploadsService.deleteFile(filename);
    return { message: 'Image deleted successfully' };
  }

  @Delete('avatar/:filename')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user avatar' })
  @ApiParam({
    name: 'filename',
    description: 'Avatar filename to delete',
    example: 'uuid-filename.jpg',
  })
  @ApiResponse({ status: 200, description: 'Avatar deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAvatar(@Param('filename') filename: string): Promise<{ message: string }> {
    await this.uploadsService.deleteFile(filename);
    return { message: 'Avatar deleted successfully' };
  }

  @Get('products/:filename')
  @ApiOperation({ summary: 'Serve product image' })
  @ApiParam({
    name: 'filename',
    description: 'Image filename',
    example: 'uuid-filename.jpg',
  })
  @ApiResponse({ status: 200, description: 'Image file' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  serveProductImage(@Param('filename') filename: string, @Res() res: Response) {
    return this.serveFile(filename, 'products', res);
  }

  @Get('avatars/:filename')
  @ApiOperation({ summary: 'Serve user avatar' })
  @ApiParam({
    name: 'filename',
    description: 'Avatar filename',
    example: 'uuid-filename.jpg',
  })
  @ApiResponse({ status: 200, description: 'Avatar file' })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  serveAvatar(@Param('filename') filename: string, @Res() res: Response) {
    return this.serveFile(filename, 'avatars', res);
  }

  private serveFile(
    filename: string,
    category: 'products' | 'avatars',
    res: Response,
  ): void {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const filePath = path.join(uploadPath, category, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }

    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31557600'); // 1 year cache

    res.sendFile(path.resolve(filePath));
  }
}