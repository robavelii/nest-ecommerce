import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, StorageService],
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}