import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService, StorageFile } from './storage.service';

@Injectable()
export class UploadsService {
  private readonly maxFileSize: number;
  private readonly allowedImageTypes: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    this.maxFileSize = this.configService.get('MAX_FILE_SIZE', 5 * 1024 * 1024);
    this.allowedImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
  }

  validateFile(file: Express.Multer.File, type: 'image' = 'image'): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`,
      );
    }

    if (type === 'image' && !this.allowedImageTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
      );
    }
  }

  async uploadSingle(
    file: Express.Multer.File,
    category: 'products' | 'avatars' = 'products',
  ): Promise<StorageFile> {
    this.validateFile(file);
    return this.storageService.uploadFile(file, category);
  }

  async uploadMultiple(
    files: Express.Multer.File[],
    category: 'products' | 'avatars' = 'products',
  ): Promise<StorageFile[]> {
    const maxFiles = this.configService.get('MAX_FILES_PER_UPLOAD', 10);

    if (files.length > maxFiles) {
      throw new BadRequestException(`Maximum ${maxFiles} files allowed`);
    }

    const uploadPromises = files.map((file) => this.uploadSingle(file, category));
    return Promise.all(uploadPromises);
  }

  async deleteFile(filename: string): Promise<void> {
    await this.storageService.deleteFile(filename);
  }

  async deleteFiles(filenames: string[]): Promise<void> {
    await Promise.all(filenames.map((filename) => this.deleteFile(filename)));
  }

  async getFileUrl(filename: string): Promise<string> {
    return this.storageService.getSignedUrl(filename);
  }

  extractFilenameFromUrl(url: string): string | null {
    try {
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      return filename || null;
    } catch (error) {
      return null;
    }
  }
}