import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageFile {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private readonly storageType: string;
  private readonly bucket: string;
  private readonly uploadPath: string;

  constructor(private readonly configService: ConfigService) {
    this.storageType = this.configService.get('STORAGE_TYPE', 'local');
    this.bucket = this.configService.get('AWS_S3_BUCKET', 'ecommerce-uploads');
    this.uploadPath = this.configService.get('UPLOAD_DEST', './uploads');

    if (this.storageType === 's3' || this.storageType === 'minio') {
      this.initializeS3Client();
    } else {
      this.ensureUploadDirectory();
    }
  }

  private initializeS3Client(): void {
    const endpoint = this.configService.get('AWS_S3_ENDPOINT');
    const region = this.configService.get('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const forcePathStyle = this.configService.get('AWS_S3_FORCE_PATH_STYLE', false);

    this.s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
      endpoint,
      forcePathStyle,
    });
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
    ['products', 'avatars', 'temp'].forEach((subdir) => {
      const fullPath = path.join(this.uploadPath, subdir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    });
  }

  async uploadFile(
    file: Express.Multer.File,
    category: 'products' | 'avatars' = 'products',
  ): Promise<StorageFile> {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const filename = `${category}/${uuidv4()}${fileExtension}`;

    if (this.storageType === 's3' || this.storageType === 'minio') {
      return this.uploadToS3(file, filename);
    }
    return this.uploadToLocal(file, filename);
  }

  private async uploadToS3(file: Express.Multer.File, key: string): Promise<StorageFile> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const endpoint = this.configService.get('AWS_S3_ENDPOINT', '');
      const url = endpoint 
        ? `${endpoint}/${this.bucket}/${key}`
        : `https://${this.bucket}.s3.amazonaws.com/${key}`;

      return {
        filename: key,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        url,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to upload file to S3');
    }
  }

  private async uploadToLocal(file: Express.Multer.File, filename: string): Promise<StorageFile> {
    const filePath = path.join(this.uploadPath, filename);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.buffer);

    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');
    const url = `${baseUrl}/uploads/${filename}`;

    return {
      filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url,
    };
  }

  async deleteFile(filename: string): Promise<void> {
    if (this.storageType === 's3' || this.storageType === 'minio') {
      await this.deleteFromS3(filename);
    } else {
      await this.deleteFromLocal(filename);
    }
  }

  private async deleteFromS3(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file from S3:', error);
    }
  }

  private async deleteFromLocal(filename: string): Promise<void> {
    const filePath = path.join(this.uploadPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async getSignedUrl(filename: string, expiresIn: number = 3600): Promise<string> {
    if (this.storageType === 's3' || this.storageType === 'minio') {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: filename,
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    }
    const baseUrl = this.configService.get('BASE_URL', 'http://localhost:3000');
    return `${baseUrl}/uploads/${filename}`;
  }
}
