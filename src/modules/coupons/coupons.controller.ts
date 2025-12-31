import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { CouponsService } from "./coupons.service";
import { CreateCouponDto } from "./dto/create-coupon.dto";
import { Role } from "../../database/entities/user.entity";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import {
  AuditLog,
  AuditAction,
  AuditResource,
} from "../../common/decorators/audit-log.decorator";

@ApiTags("Coupons")
@Controller("coupons")
@UseGuards(RolesGuard)
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @AuditLog(AuditAction.PRODUCT_CREATED, AuditResource.ORDER)
  @ApiOperation({ summary: "Create a new coupon" })
  @ApiResponse({ status: 201, description: "Coupon created successfully" })
  async create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all coupons" })
  @ApiResponse({ status: 200, description: "List of coupons" })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("status") status?: string,
  ) {
    return this.couponsService.findAll(page, limit, status as any);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get coupon by ID" })
  @ApiResponse({ status: 200, description: "Coupon details" })
  async findOne(@Param("id") id: string) {
    return this.couponsService.findOne(id);
  }

  @Put(":id")
  @Roles(Role.ADMIN)
  @AuditLog(AuditAction.PRODUCT_UPDATED, AuditResource.ORDER)
  @ApiOperation({ summary: "Update coupon" })
  @ApiResponse({ status: 200, description: "Coupon updated successfully" })
  async update(
    @Param("id") id: string,
    @Body() updateCouponDto: Partial<CreateCouponDto>,
  ) {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @AuditLog(AuditAction.PRODUCT_DELETED, AuditResource.ORDER)
  @ApiOperation({ summary: "Delete coupon" })
  @ApiResponse({ status: 200, description: "Coupon deleted successfully" })
  async remove(@Param("id") id: string) {
    return this.couponsService.remove(id);
  }
}
