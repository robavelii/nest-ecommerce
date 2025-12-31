import {
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsDateString,
  ArrayMinSize,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { DiscountType } from "../../../database/entities";

export class CreateCouponDto {
  @ApiProperty({ example: "SUMMER20" })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({ example: 20, minimum: 0 })
  @IsNumber()
  @Min(0)
  discountValue: number;

  @ApiProperty({ example: 50, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @ApiProperty({ example: 100, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @ApiProperty({ example: 1, minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsesPerUser?: number;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiProperty({ example: "2024-12-31T23:59:59Z" })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({ example: ["category-1", "category-2"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableCategories?: string[];

  @ApiProperty({ example: ["product-1", "product-2"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableProducts?: string[];

  @ApiProperty({ example: false })
  @IsOptional()
  freeShipping?: boolean;

  @ApiProperty({ example: "Summer 2024 promotion" })
  @IsOptional()
  @IsString()
  description?: string;
}
