import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsBoolean } from 'class-validator';
import { Role } from '../../../database/entities/user.entity';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.CUSTOMER,
  })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({
    description: 'User active status',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}