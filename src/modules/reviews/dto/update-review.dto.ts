import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateReviewDto {
  @ApiProperty({
    description: 'Updated rating from 1 to 5 stars',
    minimum: 1,
    maximum: 5,
    example: 4,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Rating must be at least 1' })
  @Max(5, { message: 'Rating must be at most 5' })
  @Transform(({ value }) => (value ? parseInt(value) : value))
  rating?: number;

  @ApiProperty({
    description: 'Updated review comment',
    example: 'Updated review: Still a great product!',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}