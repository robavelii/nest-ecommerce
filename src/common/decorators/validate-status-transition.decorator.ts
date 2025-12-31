import { BadRequestException } from "@nestjs/common";
import { OrderStatus } from "../../database/entities/order.entity";
import { canTransition } from "../utils/order-status.util";

export function validateOrderStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus,
): void {
  if (!canTransition(currentStatus, newStatus)) {
    throw new BadRequestException(
      `Cannot transition from ${currentStatus} to ${newStatus}`,
    );
  }
}
